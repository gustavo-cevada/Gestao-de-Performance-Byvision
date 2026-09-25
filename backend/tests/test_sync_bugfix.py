"""Regression: POST /api/sync must return quickly (background) - iteration 8."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")


def _login(username: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": username, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login {username} failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "no access_token"
    return tok


@pytest.fixture(scope="module")
def vagner_token():
    return _login("VAGNER", "vagner123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin", "admin123")


# ---- BUGFIX: /api/sync retorna rapidamente e nao bloqueia ----
class TestSyncBackground:
    def test_sync_vendedor_returns_fast(self, vagner_token):
        h = {"Authorization": f"Bearer {vagner_token}"}
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/sync", headers=h, timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("syncing") is True
        assert elapsed < 3.0, f"sync took {elapsed:.2f}s (should be <3s)"

    def test_sync_admin_returns_fast(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/sync", headers=h, timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert body.get("syncing") is True
        assert elapsed < 3.0, f"admin sync took {elapsed:.2f}s (should be <3s)"


# ---- REGRESSAO: dashboard/config/admin vendedores ----
class TestRegressions:
    def test_dashboard_vagner(self, vagner_token):
        h = {"Authorization": f"Bearer {vagner_token}"}
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "clients" in data
        assert isinstance(data["clients"], list)
        assert "total_em_risco" in data
        assert isinstance(data["total_em_risco"], int)
        assert "kpi" in data

    def test_config_public(self, vagner_token):
        h = {"Authorization": f"Bearer {vagner_token}"}
        r = requests.get(f"{BASE_URL}/api/config", headers=h, timeout=15)
        assert r.status_code == 200

    def test_admin_vendedores_sem_meta(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/vendedores", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Aceita list direto ou dict com chave
        rows = data if isinstance(data, list) else data.get("vendedores", data.get("items", []))
        assert isinstance(rows, list) and len(rows) > 0
        missing = [v for v in rows if "sem_meta" not in v]
        assert not missing, f"vendedores sem campo 'sem_meta': {[v.get('cod_vendedor') for v in missing]}"
