"""Backend tests iteration 9 — /api/clients/{cod} shape for client detail redesign."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://meta-tracker-app-1.preview.emergentagent.com",
).rstrip("/")
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


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def first_client_cod(http, vendedor_token):
    r = http.get(f"{API}/dashboard", headers=H(vendedor_token), timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["clients"], "no clients in dashboard"
    return str(d["clients"][0]["cod_cliente"])


class TestClientDetailShape:
    def test_keys_and_types(self, http, vendedor_token, first_client_cod):
        r = http.get(f"{API}/clients/{first_client_cod}", headers=H(vendedor_token), timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        # required keys per the spec
        for k in ("pedidos", "itens", "meta_mensal", "ref_month", "ref_exp",
                  "dias_uteis_ref", "compras_mensais"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["pedidos"], list)
        assert isinstance(d["itens"], list)
        assert isinstance(d["compras_mensais"], list)
        assert isinstance(d["ref_month"], str) and len(d["ref_month"]) == 7
        assert isinstance(d["ref_exp"], (int, float))
        assert 0.0 <= float(d["ref_exp"]) <= 1.0
        assert isinstance(d["dias_uteis_ref"], int)
        assert isinstance(d["meta_mensal"], (int, float))
        # cliente exists
        assert "cliente" in d
        assert d["cliente"].get("cod_cliente") == first_client_cod
        # no MongoDB _id anywhere in top-level
        assert "_id" not in d
        assert "_id" not in d["cliente"]

    def test_pedidos_shape(self, http, vendedor_token, first_client_cod):
        r = http.get(f"{API}/clients/{first_client_cod}", headers=H(vendedor_token), timeout=90)
        assert r.status_code == 200
        d = r.json()
        for p in d["pedidos"][:5]:  # amostra
            assert "id_pedido" in p
            assert "data" in p and len(str(p["data"])) == 10
            assert "valor" in p and isinstance(p["valor"], (int, float))
            assert "tipos" in p and isinstance(p["tipos"], list)

    def test_itens_shape(self, http, vendedor_token, first_client_cod):
        r = http.get(f"{API}/clients/{first_client_cod}", headers=H(vendedor_token), timeout=90)
        d = r.json()
        for it in d["itens"][:5]:
            assert "data" in it and len(str(it["data"])) == 10
            assert "familia" in it
            assert "codigo" in it
            assert "tipo" in it  # pode ser None
            if it["tipo"] is not None:
                assert it["tipo"] in ("SURFACADO", "ACABADO") or it["tipo"].isupper()
            assert "qtd" in it and isinstance(it["qtd"], (int, float))
            assert "valor" in it and isinstance(it["valor"], (int, float))

    def test_compras_mensais_shape(self, http, vendedor_token, first_client_cod):
        r = http.get(f"{API}/clients/{first_client_cod}", headers=H(vendedor_token), timeout=90)
        d = r.json()
        for m in d["compras_mensais"][:12]:
            assert "mes" in m and len(str(m["mes"])) == 7
            assert "valor" in m and isinstance(m["valor"], (int, float))

    def test_auth_required(self, http, first_client_cod):
        r = http.get(f"{API}/clients/{first_client_cod}", timeout=30)
        assert r.status_code in (401, 403)

    def test_not_found(self, http, vendedor_token):
        r = http.get(f"{API}/clients/999999999", headers=H(vendedor_token), timeout=30)
        assert r.status_code == 404
