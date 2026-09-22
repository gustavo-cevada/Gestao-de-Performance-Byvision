"""Gestao de Performance de Vendas Byvision - Backend."""
import asyncio
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

import dw_client as dw
from auth import auth_router, current_user, require_role, seed_users
from db import client, db
from seed_data import METAS_SEED

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Byvision Performance API")
api = APIRouter(prefix="/api")

_sync_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Sync: busca dados da DW API e grava no cache Mongo
# ---------------------------------------------------------------------------
async def run_sync() -> dict:
    if _sync_lock.locked():
        # Sync ja em andamento: espera terminar e retorna estado atual.
        async with _sync_lock:
            pass
        return await get_period()

    async with _sync_lock:
        logger.info("Sync DW: iniciando...")
        period = await asyncio.to_thread(dw.periodo_referencia)
        vendedor = await asyncio.to_thread(dw.get_vendedor_info)
        clientes = await asyncio.to_thread(dw.get_clientes)
        cods = [str(c.get("cod_cliente")) for c in clientes]

        # janela de 12 meses de compras faturadas (para filtro por mes/dia)
        ry, rm = int(period["ref_year"]), int(period["ref_month"])
        wy = ry - 1
        window_start = f"{wy}-{rm:02d}-01"
        ref_prefix = f"{ry}-{rm:02d}"

        janelas = await asyncio.to_thread(dw.compras_window, cods, window_start)

        for c in clientes:
            cod = str(c.get("cod_cliente"))
            compras_f = janelas.get(cod, [])
            faturado_mes = round(sum(r["v"] for r in compras_f if r["d"][:7] == ref_prefix), 2)
            doc = dict(c)
            doc["cod_cliente"] = cod
            doc["faturado_mes"] = faturado_mes
            doc["compras_f"] = compras_f
            await db.clients.update_one(
                {"cod_cliente": cod}, {"$set": doc}, upsert=True
            )
            # semear meta se ainda nao existe
            existing = await db.metas.find_one({"cod_cliente": cod})
            if not existing:
                await db.metas.update_one(
                    {"cod_cliente": cod},
                    {"$setOnInsert": {"cod_cliente": cod, "meta": METAS_SEED.get(cod, 0.0)}},
                    upsert=True,
                )

        settings = {
            "_id": "period",
            **period,
            "vendedor": vendedor,
            "last_sync": datetime.now(timezone.utc).isoformat(),
        }
        await db.settings.update_one({"_id": "period"}, {"$set": settings}, upsert=True)
        logger.info("Sync DW: concluido. %d clientes.", len(clientes))
        return {k: v for k, v in settings.items() if k != "_id"}


async def get_period() -> dict:
    s = await db.settings.find_one({"_id": "period"}, {"_id": 0})
    return s or {}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
def _client_label(c: dict) -> str:
    return (c.get("nome_fantasia") or c.get("razao_social") or "-").strip()


def only_digits(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def _to_int(v):
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return None


def status_crm(c: dict) -> str:
    """ATIVO / PRE_INATIVO / INATIVO derivado do cadastro + dias sem compra."""
    st = (c.get("status_comercial") or "").upper().strip()
    dias = _to_int(c.get("dias_sem_compra"))
    if st == "INATIVO":
        return "INATIVO"
    if dias is not None and dias >= 90:
        return "INATIVO"
    if dias is not None and dias >= 45:
        return "PRE_INATIVO"
    return "ATIVO"


def _prev_month(year: int, month: int) -> str:
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def compute_pace(meta: float, faturado: float, total_bd: int, elapsed_bd: int) -> dict:
    """Metricas de ritmo com base no andamento dos dias uteis do mes.

    - exp_frac: fracao do mes ja decorrida (dias_decorridos / total)
    - meta_esperada: quanto o cliente deveria ter faturado ate hoje
    - pct_ritmo: faturado / meta_esperada (100% = exatamente no ritmo)
    - real_frac: faturado / meta (atingimento mensal, para a barra)
    - gap_pct: exp_frac - real_frac (positivo = atrasado)
    - gap_valor: meta_esperada - faturado (positivo = atrasado)
    - meta_diaria_necessaria: quanto falta / dias uteis restantes
    """
    total_bd = int(total_bd or 0)
    elapsed_bd = int(elapsed_bd or 0)
    dias_restantes = max(0, total_bd - elapsed_bd)
    exp_frac = (elapsed_bd / total_bd) if total_bd else 0.0
    meta_esperada = round(meta * exp_frac, 2)

    real_frac = (faturado / meta) if meta > 0 else None
    pct_ritmo = (faturado / meta_esperada) if meta_esperada > 0 else None
    gap_pct = round(exp_frac - real_frac, 4) if real_frac is not None else None
    gap_valor = round(meta_esperada - faturado, 2) if meta > 0 else None

    restante = max(0.0, meta - faturado)
    if meta <= 0:
        meta_diaria_necessaria = None
    elif dias_restantes > 0:
        meta_diaria_necessaria = round(restante / dias_restantes, 2)
    else:
        meta_diaria_necessaria = round(restante, 2)

    return {
        "exp_frac": round(exp_frac, 4),
        "meta_esperada": meta_esperada,
        "pct_ritmo": round(pct_ritmo, 4) if pct_ritmo is not None else None,
        "gap_pct": gap_pct,
        "gap_valor": gap_valor,
        "meta_diaria_necessaria": meta_diaria_necessaria,
        "dias_restantes": dias_restantes,
    }


async def _load_clients_scoped(
    sel_month: str, day: str | None, total_bd: int, elapsed_bd: int
) -> tuple[list[dict], set[str]]:
    """Carrega clientes com faturado e metricas para o escopo (mes ou dia).

    Retorna (clientes, meses_disponiveis).
    """
    metas = {m["cod_cliente"]: m["meta"] async for m in db.metas.find({}, {"_id": 0})}
    out: list[dict] = []
    months: set[str] = set()

    async for c in db.clients.find({}, {"_id": 0}):
        cod = c["cod_cliente"]
        meta_mensal = float(metas.get(cod, 0.0))
        compras = c.get("compras_f") or []
        for r in compras:
            months.add(r["d"][:7])

        if day:
            faturado = round(sum(r["v"] for r in compras if r["d"] == day), 2)
            meta_scope = round(meta_mensal / total_bd, 2) if total_bd else 0.0
            pace = compute_pace(meta_scope, faturado, 1, 1)
        else:
            faturado = round(sum(r["v"] for r in compras if r["d"][:7] == sel_month), 2)
            meta_scope = meta_mensal
            pace = compute_pace(meta_scope, faturado, total_bd, elapsed_bd)

        out.append({
            "cod_cliente": cod,
            "nome": _client_label(c),
            "razao_social": c.get("razao_social"),
            "cnpj_cpf": c.get("cnpj_cpf"),
            "cidade": (c.get("cidade") or "-").strip(),
            "uf": c.get("uf"),
            "meta": meta_scope,
            "meta_mensal": meta_mensal,
            "faturado": faturado,
            "pct": round(faturado / meta_scope, 4) if meta_scope > 0 else None,
            "status_comercial": c.get("status_comercial"),
            "dias_sem_compra": c.get("dias_sem_compra"),
            **pace,
        })
    return out, months


def _sort_clients(clients: list[dict], sort: str) -> list[dict]:
    NEG = -1e18
    POS = 1e18
    if sort == "atingimento_asc":
        return sorted(clients, key=lambda c: (c["pct_ritmo"] if c["pct_ritmo"] is not None else POS, c["nome"]))
    if sort == "faturado_desc":
        return sorted(clients, key=lambda c: -c["faturado"])
    if sort == "faturado_asc":
        return sorted(clients, key=lambda c: c["faturado"])
    # default: atingimento_desc (meta mais atingida primeiro)
    return sorted(clients, key=lambda c: -(c["pct_ritmo"] if c["pct_ritmo"] is not None else NEG))


@api.get("/dashboard")
async def dashboard(
    city: str | None = Query(default=None),
    month: str | None = Query(default=None),   # "YYYY-MM"
    day: str | None = Query(default=None),      # "YYYY-MM-DD"
    sort: str = Query(default="atingimento_desc"),
    user=Depends(current_user),
):
    period = await get_period()
    ry = int(period.get("ref_year") or datetime.now().year)
    rm = int(period.get("ref_month") or datetime.now().month)
    ref_month = f"{ry}-{rm:02d}"

    sel_month = month or ref_month
    try:
        sy, sm = int(sel_month[:4]), int(sel_month[5:7])
    except (ValueError, IndexError):
        sel_month, sy, sm = ref_month, ry, rm

    # dia precisa pertencer ao mes selecionado
    if day and day[:7] != sel_month:
        day = None

    total_bd = dw.business_days_in_month(sy, sm)
    as_of_str = str(period.get("as_of") or "")[:10]
    try:
        as_of = datetime.strptime(as_of_str, "%Y-%m-%d").date()
    except ValueError:
        as_of = datetime.now().date()

    if sel_month == ref_month:
        elapsed_bd = int(period.get("dias_uteis_decorridos") or 0)
    elif sel_month < ref_month:
        elapsed_bd = total_bd  # mes passado (completo)
    else:
        elapsed_bd = 0  # mes futuro

    day_mode = bool(day)
    clients, months = await _load_clients_scoped(sel_month, day, total_bd, elapsed_bd)

    cities = sorted({c["cidade"] for c in clients if c["cidade"] and c["cidade"] != "-"})
    if city and city != "TODAS":
        filtered = [c for c in clients if c["cidade"] == city]
    else:
        filtered = clients

    meta_total = sum(c["meta"] for c in filtered)
    realizado = sum(c["faturado"] for c in filtered)

    if day_mode:
        frac = 1.0
        provisionado = round(meta_total, 2)  # alvo do dia
    else:
        frac = (elapsed_bd / total_bd) if total_bd else 0.0
        provisionado = round(meta_total * frac, 2)

    pct_prov = round(provisionado / meta_total, 4) if meta_total else 0.0
    pct_real = round(realizado / meta_total, 4) if meta_total else 0.0
    gap_valor = round(provisionado - realizado, 2)
    gap_pct = round(pct_prov - pct_real, 4)

    dias_restantes = max(0, total_bd - elapsed_bd)
    restante = max(0.0, meta_total - realizado)
    if day_mode:
        meta_do_dia = round(meta_total, 2)
    elif dias_restantes > 0:
        meta_do_dia = round(restante / dias_restantes, 2)
    else:
        meta_do_dia = round(restante, 2)

    filtered_sorted = _sort_clients(filtered, sort)
    months_list = sorted(months, reverse=True)

    return {
        "period": period,
        "scope": {
            "month": sel_month,
            "day": day,
            "day_mode": day_mode,
            "total_dias_uteis": total_bd,
            "dias_uteis_decorridos": elapsed_bd,
            "dias_uteis_restantes": dias_restantes,
            "is_ref_month": sel_month == ref_month,
        },
        "months": months_list,
        "sort": sort,
        "kpi": {
            "meta_vendas": round(meta_total, 2),
            "vendas_realizadas": round(realizado, 2),
            "venda_provisionada": provisionado,
            "gap_valor": gap_valor,
            "pct_atingimento_provisionado": pct_prov,
            "pct_atingimento_realizado": pct_real,
            "gap_pct": gap_pct,
            "fracao_periodo": round(frac, 4),
            "meta_do_dia": meta_do_dia,
        },
        "cities": cities,
        "selected_city": city or "TODAS",
        "total_clientes": len(filtered),
        "clients": filtered_sorted,
    }


@api.get("/crm")
async def crm(user=Depends(current_user)):
    period = await get_period()
    ry = int(period.get("ref_year") or datetime.now().year)
    rm = int(period.get("ref_month") or datetime.now().month)
    ref_month = f"{ry}-{rm:02d}"
    prev_month = _prev_month(ry, rm)

    metas = {m["cod_cliente"]: m["meta"] async for m in db.metas.find({}, {"_id": 0})}

    raw = []
    cur_fat: dict[str, float] = {}

    async for c in db.clients.find({}, {"_id": 0}):
        cod = c["cod_cliente"]
        compras = c.get("compras_f") or []
        fat12 = round(sum(r["v"] for r in compras), 2)
        cur = round(sum(r["v"] for r in compras if r["d"][:7] == ref_month), 2)
        cur_fat[cod] = cur
        raw.append({
            "cod_cliente": cod,
            "nome": _client_label(c),
            "razao_social": c.get("razao_social"),
            "cnpj_cpf": c.get("cnpj_cpf"),
            "cnpj_digits": only_digits(c.get("cnpj_cpf")),
            "cidade": (c.get("cidade") or "-").strip(),
            "uf": c.get("uf"),
            "dias_sem_compra": _to_int(c.get("dias_sem_compra")),
            "status": status_crm(c),
            "faturamento_12m": fat12,
            "faturamento_acumulado": float(c.get("total_compras_rs") or 0.0),
            "meta": float(metas.get(cod, 0.0)),
        })

    # ranking geral (posição atual) por faturamento 12 meses
    ordered = sorted(raw, key=lambda x: -x["faturamento_12m"])
    rank_geral = {x["cod_cliente"]: i + 1 for i, x in enumerate(ordered)}

    # ranking anterior: mesma métrica (12m) excluindo o mês de referência,
    # representa a posição do cliente no fim do mês passado.
    prev_fat12 = {
        x["cod_cliente"]: round(x["faturamento_12m"] - cur_fat.get(x["cod_cliente"], 0.0), 2)
        for x in raw
    }
    ordered_prev = sorted(raw, key=lambda x: -prev_fat12[x["cod_cliente"]])
    prev_rank_geral = {x["cod_cliente"]: i + 1 for i, x in enumerate(ordered_prev)}

    for x in raw:
        cod = x["cod_cliente"]
        cur_pos = rank_geral.get(cod)
        prev_pos = prev_rank_geral.get(cod)
        x["rank"] = cur_pos
        curf12 = x["faturamento_12m"]
        prevf12 = prev_fat12[cod]
        if curf12 <= 0:
            # sem faturamento no período -> ranking não relevante
            x["rank_delta"] = None
            x["movimento"] = "parado"
        elif prevf12 <= 0:
            # passou a faturar agora (novo no ranking)
            x["rank_delta"] = None
            x["movimento"] = "novo"
        else:
            # delta = posição_anterior - posição_atual
            # positivo => subiu (menor número = melhor posição)
            delta = prev_pos - cur_pos
            x["rank_delta"] = delta
            x["movimento"] = "subiu" if delta > 0 else "desceu" if delta < 0 else "estavel"

    ordered_out = sorted(raw, key=lambda x: (x["rank"] is None, x["rank"] or 9999))

    total = len(raw)
    ativos = sum(1 for x in raw if x["status"] == "ATIVO")
    pre = sum(1 for x in raw if x["status"] == "PRE_INATIVO")
    inativos = sum(1 for x in raw if x["status"] == "INATIVO")

    def pct(n):
        return round(n / total, 4) if total else 0.0

    cities = sorted({x["cidade"] for x in raw if x["cidade"] and x["cidade"] != "-"})

    return {
        "summary": {
            "total": total,
            "ativos": ativos,
            "pre_inativos": pre,
            "inativos": inativos,
            "pct_ativos": pct(ativos),
            "pct_pre_inativos": pct(pre),
            "pct_inativos": pct(inativos),
        },
        "cities": cities,
        "ref_month": ref_month,
        "prev_month": prev_month,
        "clients": ordered_out,
    }


@api.get("/clients/{cod}")
async def client_detail(cod: str, user=Depends(current_user)):
    c = await db.clients.find_one({"cod_cliente": str(cod)}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    meta_doc = await db.metas.find_one({"cod_cliente": str(cod)}, {"_id": 0})
    meta = float(meta_doc["meta"]) if meta_doc else 0.0
    period = await get_period()

    # historico de compras (ao vivo, ultimos ~8 meses)
    desde = period.get("ref_year", datetime.now().year)
    ano = int(period.get("ref_year", datetime.now().year))
    mes = int(period.get("ref_month", datetime.now().month))
    start_ano = ano if mes > 8 else ano - 1
    start_mes = mes - 7 if mes > 7 else mes + 5
    desde_str = f"{start_ano}-{start_mes:02d}-01"

    compras = await asyncio.to_thread(dw.get_compras, str(cod), desde_str)
    compras_f = [r for r in compras if str(r.get("situacao_pedido")) == "F"]

    # agregacao mensal
    mensal: dict[str, float] = {}
    for r in compras_f:
        m = str(r.get("data_baixa", ""))[:7]
        mensal[m] = round(mensal.get(m, 0.0) + float(r.get("valor") or 0), 2)
    mensal_list = [{"mes": k, "valor": v} for k, v in sorted(mensal.items())]

    faturado = float(c.get("faturado_mes") or 0.0)
    recent = sorted(compras_f, key=lambda r: str(r.get("data_baixa", "")), reverse=True)[:40]

    pace = compute_pace(
        meta, faturado,
        period.get("total_dias_uteis") or 0,
        period.get("dias_uteis_decorridos") or 0,
    )

    # metricas CRM
    fat12 = round(sum(r["v"] for r in (c.get("compras_f") or [])), 2)
    qtd_ped = _to_int(c.get("qtd_pedidos")) or 0
    acumulado = float(c.get("total_compras_rs") or 0.0)
    ticket_medio = round(acumulado / qtd_ped, 2) if qtd_ped > 0 else 0.0
    c_clean = {k: v for k, v in c.items() if k != "compras_f"}

    return {
        "cliente": {**c_clean, "meta": meta, "faturado": faturado,
                    "pct": round(faturado / meta, 4) if meta > 0 else None,
                    "nome": _client_label(c), "status_crm": status_crm(c),
                    "faturamento_12m": fat12, "faturamento_acumulado": acumulado,
                    "ticket_medio": ticket_medio, **pace},
        "compras_mensais": mensal_list,
        "compras_recentes": recent,
        "period": period,
    }


# ---------------------------------------------------------------------------
# Admin: metas
# ---------------------------------------------------------------------------
class MetaUpdate(BaseModel):
    cod_cliente: str
    meta: float


class MetasBulk(BaseModel):
    metas: list[MetaUpdate]


@api.get("/admin/metas")
async def admin_list_metas(user=Depends(require_role("admin"))):
    metas = {m["cod_cliente"]: m["meta"] async for m in db.metas.find({}, {"_id": 0})}
    clients = []
    async for c in db.clients.find({}, {"_id": 0, "compras_f": 0}):
        cod = c["cod_cliente"]
        clients.append({
            "cod_cliente": cod,
            "nome": _client_label(c),
            "cidade": (c.get("cidade") or "-").strip(),
            "meta": float(metas.get(cod, 0.0)),
            "faturado": float(c.get("faturado_mes") or 0.0),
        })
    clients_sorted = sorted(clients, key=lambda c: c["nome"])
    total = sum(c["meta"] for c in clients_sorted)
    return {"total_meta": round(total, 2), "clients": clients_sorted}


@api.put("/admin/metas")
async def admin_update_metas(body: MetasBulk, user=Depends(require_role("admin"))):
    for item in body.metas:
        await db.metas.update_one(
            {"cod_cliente": str(item.cod_cliente)},
            {"$set": {"cod_cliente": str(item.cod_cliente), "meta": float(item.meta)}},
            upsert=True,
        )
    total = sum([m["meta"] async for m in db.metas.find({}, {"_id": 0, "meta": 1})])
    return {"ok": True, "total_meta": round(total, 2)}


# ---------------------------------------------------------------------------
# Sync / status
# ---------------------------------------------------------------------------
@api.post("/sync")
async def sync_now(user=Depends(current_user)):
    settings = await run_sync()
    return {"ok": True, "settings": settings}


@api.get("/status")
async def status(user=Depends(current_user)):
    period = await get_period()
    n = await db.clients.count_documents({})
    return {"period": period, "total_clientes": n, "syncing": _sync_lock.locked()}


@api.get("/")
async def root():
    return {"app": "Byvision Performance API", "ok": True}


app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed_users()
    n = await db.clients.count_documents({})
    if n == 0:
        # primeira carga em background para nao travar o boot
        asyncio.create_task(_safe_initial_sync())


async def _safe_initial_sync():
    try:
        await run_sync()
    except Exception as exc:  # noqa: BLE001
        logger.error("Sync inicial falhou: %s", exc)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
