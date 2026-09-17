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
_TIMEOUT = 30


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
    resp = requests.get(f"{DW_API_URL}/health", timeout=_TIMEOUT, verify=False)
    resp.raise_for_status()
    return resp.json()


def get_vendedor_info() -> dict | None:
    """Dados oficiais do vendedor (nome, ativo, qt_clientes)."""
    data = _get("/vendedores")
    itens = data if isinstance(data, list) else data.get("itens", [])
    for v in itens:
        if int(v.get("cod_vendedor", -1)) == VENDEDOR_COD:
            return v
    return None


def get_clientes() -> list[dict]:
    """Todos os clientes do vendedor (Cliente 360)."""
    data = _get("/clientes", {"cod_vendedor": VENDEDOR_COD, "page_size": 500, "page": 1})
    itens = data.get("itens", []) if isinstance(data, dict) else data
    return itens


def get_compras(cod: str, desde: str) -> list[dict]:
    try:
        data = _get(f"/clientes/{cod}/compras", {"desde": desde})
        return data if isinstance(data, list) else data.get("itens", [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("compras falhou para %s: %s", cod, exc)
        return []


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


def periodo_referencia() -> dict:
    """Determina o mes de referencia a partir do frescor da fonte de compras.

    Usa a data da ultima baixa (dm_valorcompra_ultima) como "hoje" comercial,
    e conta dias uteis do mes.
    """
    health = get_health()
    ultima = str(health.get("dm_valorcompra_ultima") or "")[:10]
    try:
        as_of = datetime.strptime(ultima, "%Y-%m-%d").date()
    except ValueError:
        as_of = date.today()

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
