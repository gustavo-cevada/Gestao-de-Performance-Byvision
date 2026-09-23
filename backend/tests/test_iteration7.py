"""Backend tests iteration 7 - config, feriados, sem_meta, at_risk, day-mode filter."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://metas-admin-staging.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def vendedor_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": "VAGNER", "password": "vagner123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- /api/config + /api/admin/config ----------
class TestConfig:
    def test_get_public_config(self, http):
        r = http.get(f"{API}/config")
        assert r.status_code == 200
        d = r.json()
        assert "labels" in d
        assert "thresholds" in d
        assert "yellow" in d["thresholds"]
        assert "green" in d["thresholds"]
        # defaults
        assert isinstance(d["thresholds"]["yellow"], (int, float))
        assert isinstance(d["thresholds"]["green"], (int, float))

    def test_put_config_requires_admin(self, http, vendedor_token):
        r = http.put(f"{API}/admin/config", headers=H(vendedor_token),
                     json={"labels": {"kpi_faturado": "Faturado"}})
        assert r.status_code in (401, 403)

    def test_put_config_updates_and_reflects_in_public(self, http, admin_token):
        # get current
        original = http.get(f"{API}/config").json()
        try:
            # change thresholds and one label
            r = http.put(f"{API}/admin/config", headers=H(admin_token),
                         json={"labels": {"kpi_faturado": "Faturado TESTE"},
                               "thresholds": {"yellow": 0.80, "green": 1.05}})
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["thresholds"]["yellow"] == 0.80
            assert d["thresholds"]["green"] == 1.05
            assert d["labels"].get("kpi_faturado") == "Faturado TESTE"

            # public GET reflects
            pub = http.get(f"{API}/config").json()
            assert pub["thresholds"]["yellow"] == 0.80
            assert pub["thresholds"]["green"] == 1.05
            assert pub["labels"].get("kpi_faturado") == "Faturado TESTE"
        finally:
            # restore defaults: 0.76 / 1.0 and empty labels
            http.put(f"{API}/admin/config", headers=H(admin_token),
                     json={"labels": {}, "thresholds": {"yellow": 0.76, "green": 1.0}})
            restored = http.get(f"{API}/config").json()
            assert restored["thresholds"]["yellow"] == 0.76
            assert restored["thresholds"]["green"] == 1.0


# ---------- feriados admin ----------
class TestHolidays:
    def test_list_holidays_shape(self, http, admin_token):
        r = http.get(f"{API}/admin/holidays", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "holidays" in d
        assert "dias_uteis" in d
        for k in ("total", "decorridos", "restantes", "feriados_mes"):
            assert k in d["dias_uteis"], f"missing {k}"

    def test_add_delete_holiday_and_dashboard_reflects(self, http, admin_token, vendedor_token):
        # baseline
        base_admin = http.get(f"{API}/admin/holidays", headers=H(admin_token)).json()
        base_total = int(base_admin["dias_uteis"]["total"])
        base_feriados = int(base_admin["dias_uteis"]["feriados_mes"])

        # dashboard baseline em 2026-09
        dash_base = http.get(f"{API}/dashboard", params={"month": "2026-09"},
                             headers=H(vendedor_token)).json()
        dash_base_total = int(dash_base["scope"]["total_dias_uteis"])

        added = False
        try:
            r = http.post(f"{API}/admin/holidays", headers=H(admin_token),
                          json={"date": "2026-09-07", "nome": "Independencia (TEST)"})
            assert r.status_code == 200, r.text
            added = True

            after_admin = http.get(f"{API}/admin/holidays", headers=H(admin_token)).json()
            # 2026-09-07 is a Monday (weekday), so should reduce
            assert after_admin["dias_uteis"]["feriados_mes"] >= base_feriados + 1
            assert after_admin["dias_uteis"]["total"] == base_total - 1

            dash_after = http.get(f"{API}/dashboard", params={"month": "2026-09"},
                                  headers=H(vendedor_token)).json()
            assert dash_after["scope"]["total_dias_uteis"] == dash_base_total - 1
        finally:
            if added:
                dr = http.delete(f"{API}/admin/holidays/2026-09-07", headers=H(admin_token))
                assert dr.status_code == 200
                back_admin = http.get(f"{API}/admin/holidays", headers=H(admin_token)).json()
                assert back_admin["dias_uteis"]["total"] == base_total
                dash_back = http.get(f"{API}/dashboard", params={"month": "2026-09"},
                                     headers=H(vendedor_token)).json()
                assert dash_back["scope"]["total_dias_uteis"] == dash_base_total

    def test_holidays_rbac(self, http, vendedor_token):
        r = http.get(f"{API}/admin/holidays", headers=H(vendedor_token))
        assert r.status_code in (401, 403)


# ---------- sem_meta ----------
class TestSemMeta:
    def test_metas_sem_meta_field(self, http, admin_token):
        r = http.get(f"{API}/admin/metas", params={"vendedor": 204}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "sem_meta" in d, "missing sem_meta"
        assert "total_clientes" in d, "missing total_clientes"
        assert isinstance(d["sem_meta"], int)
        assert isinstance(d["total_clientes"], int)
        # sanity: sem_meta shouldn't exceed total_clientes
        assert d["sem_meta"] <= d["total_clientes"]
        # cross-check: count clients with meta<=0
        zeros = sum(1 for c in d["clients"] if float(c.get("meta") or 0) <= 0)
        assert d["sem_meta"] == zeros

    def test_vendedores_sem_meta_per_row(self, http, admin_token):
        r = http.get(f"{API}/admin/vendedores", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "vendedores" in d or isinstance(d, list)
        rows = d["vendedores"] if isinstance(d, dict) else d
        assert rows, "no vendedores"
        # each row must have sem_meta (spec: retorna sem_meta por vendedor)
        # currently only synced rows have it; report unsynced miss.
        missing_synced = [r for r in rows if r.get("synced") and "sem_meta" not in r]
        missing_unsynced = [r for r in rows if not r.get("synced") and "sem_meta" not in r]
        assert not missing_synced, f"synced vendedores missing sem_meta: {missing_synced}"
        # soft check for unsynced - spec says all rows should have sem_meta
        if missing_unsynced:
            pytest.fail(
                f"{len(missing_unsynced)} unsynced vendedores missing sem_meta field "
                f"(spec requires per-vendedor); first={missing_unsynced[0]}"
            )


# ---------- at_risk / total_em_risco / razao_social / nome_fantasia ----------
class TestAtRisk:
    def test_dashboard_at_risk_fields(self, http, vendedor_token):
        d = http.get(f"{API}/dashboard", headers=H(vendedor_token)).json()
        assert "total_em_risco" in d
        assert isinstance(d["total_em_risco"], int)
        assert d["clients"], "no clients"
        for c in d["clients"]:
            assert "at_risk" in c, f"missing at_risk: {c.get('cod_cliente')}"
            assert isinstance(c["at_risk"], bool)
            assert "risk_reason" in c, f"missing risk_reason: {c.get('cod_cliente')}"
            assert "razao_social" in c
            assert "nome_fantasia" in c
        # total_em_risco matches count
        at_risk_count = sum(1 for c in d["clients"] if c["at_risk"])
        assert d["total_em_risco"] == at_risk_count


# ---------- day mode filters clients ----------
class TestDayMode:
    def test_day_mode_only_positive_faturado(self, http, vendedor_token):
        r = http.get(f"{API}/dashboard",
                     params={"month": "2026-09", "day": "2026-09-22"},
                     headers=H(vendedor_token))
        assert r.status_code == 200
        d = r.json()
        assert d["scope"]["day_mode"] is True
        # all clients listed must have faturado > 0
        for c in d["clients"]:
            assert float(c["faturado"]) > 0, f"client {c.get('cod_cliente')} has faturado=0 in day mode"
