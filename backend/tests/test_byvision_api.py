"""Backend tests for Gestao de Performance de Vendas Byvision."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://meta-tracker-app-1.preview.emergentagent.com").rstrip("/")
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
    data = r.json()
    assert data["user"]["role"] == "vendedor"
    assert data["user"]["cod_vendedor"] == 204
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_vendedor(self, http):
        r = http.post(f"{API}/auth/login", json={"identifier": "VAGNER", "password": "vagner123"})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["user"]["username"] == "VAGNER"
        assert d["user"]["role"] == "vendedor"

    def test_login_admin(self, http):
        r = http.post(f"{API}/auth/login", json={"identifier": "admin", "password": "admin123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_login_wrong(self, http):
        r = http.post(f"{API}/auth/login", json={"identifier": "VAGNER", "password": "wrong"})
        assert r.status_code == 401

    def test_me_vendedor(self, http, vendedor_token):
        r = http.get(f"{API}/auth/me", headers=_h(vendedor_token))
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == "VAGNER"
        assert d["role"] == "vendedor"

    def test_me_unauth(self, http):
        r = http.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_shape(self, http, vendedor_token):
        r = http.get(f"{API}/dashboard", headers=_h(vendedor_token))
        assert r.status_code == 200
        d = r.json()
        for key in ["kpi", "cities", "clients", "period", "selected_city", "total_clientes"]:
            assert key in d, f"missing {key}"
        kpi = d["kpi"]
        for key in ["meta_vendas", "vendas_realizadas", "venda_provisionada", "gap_valor",
                    "pct_atingimento_provisionado", "pct_atingimento_realizado", "gap_pct"]:
            assert key in kpi, f"missing kpi.{key}"
        assert isinstance(d["cities"], list)
        assert isinstance(d["clients"], list)
        assert d["total_clientes"] == len(d["clients"])

    def test_dashboard_has_clients(self, http, vendedor_token):
        # If empty, force a sync and retry once
        r = http.get(f"{API}/dashboard", headers=_h(vendedor_token))
        d = r.json()
        if not d["clients"]:
            http.post(f"{API}/sync", headers=_h(vendedor_token), timeout=120)
            time.sleep(2)
            r = http.get(f"{API}/dashboard", headers=_h(vendedor_token))
            d = r.json()
        assert len(d["clients"]) > 0, "No clients returned"
        assert len(d["cities"]) > 0, "No cities returned"

    def test_dashboard_city_filter(self, http, vendedor_token):
        all_r = http.get(f"{API}/dashboard", headers=_h(vendedor_token)).json()
        cities = all_r["cities"]
        assert cities, "no cities to test filter"
        target = cities[0]
        f_r = http.get(f"{API}/dashboard", params={"city": target}, headers=_h(vendedor_token)).json()
        assert f_r["selected_city"] == target
        # all filtered clients must belong to that city
        for c in f_r["clients"]:
            assert c["cidade"] == target
        # totals must differ or match if only 1 city
        assert f_r["kpi"]["meta_vendas"] <= all_r["kpi"]["meta_vendas"] + 0.01

    def test_dashboard_kpi_math(self, http, vendedor_token):
        d = http.get(f"{API}/dashboard", headers=_h(vendedor_token)).json()
        k = d["kpi"]
        # gap = provisionado - realizado
        assert abs(k["gap_valor"] - (k["venda_provisionada"] - k["vendas_realizadas"])) < 0.5
        # pct real coherent
        if k["meta_vendas"]:
            expected_pct = round(k["vendas_realizadas"] / k["meta_vendas"], 4)
            assert abs(k["pct_atingimento_realizado"] - expected_pct) < 0.01


# ---------- Clients ----------
class TestClients:
    def test_client_detail(self, http, vendedor_token):
        d = http.get(f"{API}/dashboard", headers=_h(vendedor_token)).json()
        assert d["clients"], "no clients"
        cod = d["clients"][0]["cod_cliente"]
        r = http.get(f"{API}/clients/{cod}", headers=_h(vendedor_token), timeout=60)
        assert r.status_code == 200
        dd = r.json()
        assert "cliente" in dd
        assert "compras_mensais" in dd
        assert "compras_recentes" in dd
        assert dd["cliente"]["cod_cliente"] == cod

    def test_client_404(self, http, vendedor_token):
        r = http.get(f"{API}/clients/99999999", headers=_h(vendedor_token))
        assert r.status_code == 404


# ---------- Admin RBAC + metas ----------
class TestAdminMetas:
    def test_metas_rbac_forbidden(self, http, vendedor_token):
        r = http.get(f"{API}/admin/metas", headers=_h(vendedor_token))
        assert r.status_code == 403

    def test_metas_list(self, http, admin_token):
        r = http.get(f"{API}/admin/metas", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "total_meta" in d and "clients" in d
        assert isinstance(d["clients"], list)

    def test_metas_update_and_recalc(self, http, admin_token):
        cur = http.get(f"{API}/admin/metas", headers=_h(admin_token)).json()
        assert cur["clients"], "no clients to update"
        target = cur["clients"][0]
        cod = target["cod_cliente"]
        original = float(target["meta"])
        new_val = original + 1234.56

        # PUT update
        r = http.put(f"{API}/admin/metas", headers=_h(admin_token),
                     json={"metas": [{"cod_cliente": cod, "meta": new_val}]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "total_meta" in d

        # Verify persistence via GET
        after = http.get(f"{API}/admin/metas", headers=_h(admin_token)).json()
        found = [c for c in after["clients"] if c["cod_cliente"] == cod][0]
        assert abs(float(found["meta"]) - new_val) < 0.01

        # Restore
        http.put(f"{API}/admin/metas", headers=_h(admin_token),
                 json={"metas": [{"cod_cliente": cod, "meta": original}]})


# ---------- Status ----------
class TestStatus:
    def test_status(self, http, vendedor_token):
        r = http.get(f"{API}/status", headers=_h(vendedor_token))
        assert r.status_code == 200
        d = r.json()
        assert "period" in d
        assert "total_clientes" in d
