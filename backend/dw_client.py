"""Cliente para a API do Data Warehouse (Audax/Byvision).

Consome a API de leitura externa (SQL Server) descrita no documento de
integração. Usa a identidade de um responsavel privilegiado (DW_RESP_ID) para
buscar os clientes de um vendedor especifico (VENDEDOR_COD) e calcular o
faturamento do mes corrente por cliente.
"""
import os
import logging
from pathlib import Path
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

DW_API_URL = os.environ["DW_API_URL"].rstrip("/")
DW_API_KEY = os.environ["DW_API_KEY"]
DW_RESP_ID = os.environ["DW_RESP_ID"]
VENDEDOR_COD = int(os.environ["VENDEDOR_COD"])

_HEADERS = {"X-API-Key": DW_API_KEY}
_TIMEOUT = (8, 20)  # (connect, read) — curto p/ falhar rápido em host instável


def _get(path: str, params: dict | None = None):
    params = dict(params or {})
    params.setdefault("id_responsavel", DW_RESP_ID)
    resp = requests.get(
        f"{DW_API_URL}{path}", headers=_HEADERS, params=params,
        timeout=_TIMEOUT, verify=False,
    )
    resp.raise_for_status()
    return resp.json()


def get_health() -> dict:
    resp = requests.get(f"{DW_API_URL}/health", headers=_HEADERS, timeout=_TIMEOUT, verify=False)
    resp.raise_for_status()
    return resp.json()


def get_status() -> dict:
    """Health-check simples (nao exige chave). Traz cache_generated_at."""
    resp = requests.get(f"{DW_API_URL}/status", timeout=_TIMEOUT, verify=False)
    resp.raise_for_status()
    return resp.json()


def _all_clientes() -> list[dict]:
    """Todos os clientes (Cliente 360), sem filtro de vendedor, paginando."""
    out: list[dict] = []
    page = 1
    while True:
        data = _get("/clientes", {"page_size": 500, "page": page})
        itens = data.get("itens", []) if isinstance(data, dict) else data
        if not itens:
            break
        out.extend(itens)
        if len(itens) < 500:
            break
        page += 1
        if page > 40:  # guard-rail (~20k registros)
            break
    return out


def get_all_vendedores() -> list[dict]:
    """Lista de vendedores derivada dos clientes (a API nao tem /vendedores).

    Agrega por cod_vendedor a partir do Cliente 360 (cod_vendedor,
    vendedor_nome, vendedor_ativo) e conta clientes por vendedor.
    """
    agg: dict[int, dict] = {}
    for c in _all_clientes():
        try:
            cod = int(c.get("cod_vendedor"))
        except (TypeError, ValueError):
            continue
        a = agg.setdefault(cod, {
            "cod_vendedor": cod, "nome": None, "email": None,
            "ativo": None, "qt_clientes": 0,
        })
        a["qt_clientes"] += 1
        if not a["nome"]:
            a["nome"] = (c.get("vendedor_nome") or "").strip() or None
        if a["ativo"] is None:
            a["ativo"] = c.get("vendedor_ativo")
    return sorted(agg.values(), key=lambda x: x["cod_vendedor"])


def get_vendedor_info(cod_vendedor: int | None = None) -> dict | None:
    """Dados do vendedor (derivados dos clientes)."""
    cod = int(cod_vendedor) if cod_vendedor is not None else VENDEDOR_COD
    for v in get_all_vendedores():
        if int(v.get("cod_vendedor", -1)) == cod:
            return v
    return None


def get_clientes(cod_vendedor: int | None = None) -> list[dict]:
    """Todos os clientes do vendedor (Cliente 360), paginando se necessario."""
    cod = int(cod_vendedor) if cod_vendedor is not None else VENDEDOR_COD
    out: list[dict] = []
    page = 1
    while True:
        data = _get("/clientes", {"cod_vendedor": cod, "page_size": 500, "page": page})
        itens = data.get("itens", []) if isinstance(data, dict) else data
        if not itens:
            break
        out.extend(itens)
        if len(itens) < 500:
            break
        page += 1
        if page > 20:  # guard-rail
            break
    return out


def get_compras(cod: str, desde: str) -> list[dict]:
    try:
        data = _get(f"/clientes/{cod}/compras", {"desde": desde})
        return data if isinstance(data, list) else data.get("itens", [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("compras falhou para %s: %s", cod, exc)
        return []


def get_compras_itens(cod: str, desde: str) -> list[dict]:
    """Itens por pedido/dia (endpoint /clientes/{cod}/compras-itens), paginando.

    Retorna item a item com id_pedido, data_baixa (dia), familia_produto,
    codigo_chave, sku, tipo (SURFACADO/ACABADO), grupo, marca, quantidade, valor.
    """
    out: list[dict] = []
    page = 1
    while True:
        try:
            data = _get(f"/clientes/{cod}/compras-itens", {"desde": desde, "page_size": 500, "page": page})
        except Exception as exc:  # noqa: BLE001
            logger.warning("compras-itens falhou para %s: %s", cod, exc)
            break
        itens = data.get("itens", []) if isinstance(data, dict) else data
        if not itens:
            break
        out.extend(itens)
        if len(itens) < 500:
            break
        page += 1
        if page > 30:  # guard-rail
            break
    return out


def faturamento_periodo(cod: str, desde: str, ate: str) -> float:
    """Soma dos pedidos FATURADOS (situacao_pedido == 'F') no periodo."""
    total = 0.0
    for row in get_compras(cod, desde):
        if str(row.get("situacao_pedido")) != "F":
            continue
        d = str(row.get("data_baixa", ""))[:10]
        if desde <= d <= ate:
            total += float(row.get("valor") or 0)
    return round(total, 2)


def faturamento_todos(cods: list[str], desde: str, ate: str) -> dict:
    """Calcula o faturamento do periodo para varios clientes em paralelo."""
    result: dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(faturamento_periodo, c, desde, ate): c for c in cods}
        for fut in futures:
            cod = futures[fut]
            try:
                result[cod] = fut.result()
            except Exception:  # noqa: BLE001
                result[cod] = 0.0
    return result


def _compras_f_list(cod: str, desde: str) -> list[dict]:
    """Lista de compras FATURADAS [{d, v}] desde uma data (janela)."""
    out = []
    for row in get_compras(cod, desde):
        if str(row.get("situacao_pedido")) != "F":
            continue
        d = str(row.get("data_baixa", ""))[:10]
        if not d:
            continue
        out.append({"d": d, "v": float(row.get("valor") or 0)})
    return out


def compras_window(cods: list[str], desde: str) -> dict:
    """Busca em paralelo a janela de compras faturadas de varios clientes."""
    result: dict[str, list] = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_compras_f_list, c, desde): c for c in cods}
        for fut in futures:
            cod = futures[fut]
            try:
                result[cod] = fut.result()
            except Exception:  # noqa: BLE001
                result[cod] = []
    return result


def business_days_in_month(year: int, month: int) -> int:
    start = date(year, month, 1)
    end = (date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)) - timedelta(days=1)
    return _business_days(start, end)


def business_days_until(year: int, month: int, ate: date) -> int:
    start = date(year, month, 1)
    return _business_days(start, ate)


# ---------------------------------------------------------------------------
# Dias uteis
# ---------------------------------------------------------------------------
def _business_days(start: date, end: date) -> int:
    if end < start:
        return 0
    count = 0
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # 0-4 = seg-sex
            count += 1
        cur += timedelta(days=1)
    return count


def _as_of_date() -> date:
    """Data comercial de referencia ("hoje") a partir do frescor do cache.

    A nova API nao expoe mais 'dm_valorcompra_ultima'. Usamos, em ordem:
    /status.cache_generated_at, /health.generated_at, senao a data local.
    """
    candidates = [
        ("status", "cache_generated_at"),
        ("status", "produtos_cache_generated_at"),
        ("health", "generated_at"),
    ]
    cache: dict = {}
    for src, key in candidates:
        try:
            if src not in cache:
                cache[src] = get_status() if src == "status" else get_health()
            raw = str(cache[src].get(key) or "")[:10]
            return datetime.strptime(raw, "%Y-%m-%d").date()
        except Exception:  # noqa: BLE001
            continue
    return date.today()


def periodo_referencia() -> dict:
    """Determina o mes de referencia a partir do frescor do cache da fonte.

    Usa a data de geracao do cache como "hoje" comercial e conta dias uteis.
    """
    as_of = _as_of_date()

    ref_year, ref_month = as_of.year, as_of.month
    month_start = date(ref_year, ref_month, 1)
    if ref_month == 12:
        next_month = date(ref_year + 1, 1, 1)
    else:
        next_month = date(ref_year, ref_month + 1, 1)
    month_end = next_month - timedelta(days=1)

    total_bd = _business_days(month_start, month_end)
    elapsed_bd = _business_days(month_start, as_of)

    return {
        "ref_year": ref_year,
        "ref_month": ref_month,
        "month_start": month_start.isoformat(),
        "as_of": as_of.isoformat(),
        "total_dias_uteis": total_bd,
        "dias_uteis_decorridos": elapsed_bd,
    }
