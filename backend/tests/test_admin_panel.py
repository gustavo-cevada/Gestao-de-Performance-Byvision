"""Backend tests for Painel Administrativo (nova feature).

Cobre: /api/admin/vendedores, /api/admin/vendedores/{cod}/sync,
       /api/auth/users (list/create/patch/reset-password),
       escopo de /api/dashboard e /api/clients/{cod}.
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# Fixtures compartilhadas
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def vendedor_token(http):
    r = http.post(f"{API}/auth/login", json={"identifier": "VAGNER", "password": "vagner123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Auth login (admin/vendedor)
# ---------------------------------------------------------------------------
class TestAuthLogin:
    def test_admin_login(self, http):
        r = http.post(f"{API}/auth/login", json={"identifier": "admin", "password": "admin123"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert d["user"]["username"] == "admin"
        assert "access_token" in d

    def test_vendedor_login(self, http):
        r = http.post(f"{API}/auth/login", json={"identifier": "VAGNER", "password": "vagner123"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "vendedor"
        assert d["user"]["cod_vendedor"] == 204


# ---------------------------------------------------------------------------
# GET /api/admin/vendedores (admin) e RBAC
# ---------------------------------------------------------------------------
class TestAdminVendedores:
    def test_list_vendedores_rbac_forbidden(self, http, vendedor_token):
        r = http.get(f"{API}/admin/vendedores", headers=_h(vendedor_token))
        assert r.status_code == 403

    def test_list_vendedores_shape(self, http, admin_token):
        r = http.get(f"{API}/admin/vendedores", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200
        d = r.json()
        for key in ["ref_month", "period", "totals", "vendedores"]:
            assert key in d, f"missing {key}"
        totals = d["totals"]
        for key in ["faturado", "meta", "vendedores", "sincronizados"]:
            assert key in totals
        assert isinstance(d["vendedores"], list)
        assert d["totals"]["vendedores"] == len(d["vendedores"]) or len(d["vendedores"]) > 0

    def test_vagner_appears_synced(self, http, admin_token):
        d = http.get(f"{API}/admin/vendedores", headers=_h(admin_token)).json()
        vag = [v for v in d["vendedores"] if int(v["cod_vendedor"]) == 204]
        assert vag, "VAGNER (cod 204) nao esta na lista"
        v = vag[0]
        assert v["synced"] is True
        assert "faturado" in v and "meta" in v
        assert isinstance(v["faturado"], (int, float))


# ---------------------------------------------------------------------------
# POST /api/admin/vendedores/{cod}/sync
# ---------------------------------------------------------------------------
class TestAdminSyncVendedor:
    def test_sync_starts_and_completes(self, http, admin_token):
        # cod 68 conforme instrucoes (poucos clientes)
        cod = 68
        r = http.post(f"{API}/admin/vendedores/{cod}/sync", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True and d.get("syncing") is True

        # poll ate 60s por syncing:false
        deadline = time.time() + 60
        state = None
        while time.time() < deadline:
            time.sleep(3)
            lst = http.get(f"{API}/admin/vendedores", headers=_h(admin_token)).json()
            row = next((v for v in lst["vendedores"] if int(v["cod_vendedor"]) == cod), None)
            if row is None:
                continue
            state = row
            if row.get("syncing") is False:
                break
        assert state is not None, f"vendedor {cod} nao encontrado"
        assert state.get("syncing") is False, f"sync nao finalizou: {state}"
        assert state.get("synced") is True

    def test_sync_forbidden_for_vendedor(self, http, vendedor_token):
        r = http.post(f"{API}/admin/vendedores/68/sync", headers=_h(vendedor_token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# /api/auth/users - listar/criar/editar/reset
# ---------------------------------------------------------------------------
class TestUserManagement:
    def test_list_users_rbac_forbidden(self, http, vendedor_token):
        r = http.get(f"{API}/auth/users", headers=_h(vendedor_token))
        assert r.status_code == 403

    def test_list_users_no_password_hash(self, http, admin_token):
        r = http.get(f"{API}/auth/users", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("users"), list)
        assert d["users"], "sem usuarios"
        for u in d["users"]:
            assert "password_hash" not in u
            assert "id" in u
            assert "username" in u
            assert "role" in u

    def test_create_edit_reset_flow(self, http, admin_token):
        uname = f"TEST_{uuid.uuid4().hex[:8]}"
        pw = "senha123"

        # CREATE
        r = http.post(f"{API}/auth/users", headers=_h(admin_token), json={
            "username": uname, "password": pw, "nome": "TEST Usuario",
            "role": "vendedor", "cod_vendedor": 999,
        })
        assert r.status_code == 201, r.text
        created = r.json()
        uid = created["id"]
        assert created["username"] == uname
        assert created["role"] == "vendedor"
        assert created["cod_vendedor"] == 999
        assert "password_hash" not in created

        try:
            # Duplicado -> 409
            dup = http.post(f"{API}/auth/users", headers=_h(admin_token), json={
                "username": uname, "password": pw, "nome": "X", "role": "vendedor",
            })
            assert dup.status_code == 409

            # Senha curta -> 422
            r_short = http.post(f"{API}/auth/users", headers=_h(admin_token), json={
                "username": f"TEST_{uuid.uuid4().hex[:6]}", "password": "1", "nome": "X",
                "role": "vendedor",
            })
            assert r_short.status_code == 422
            # Username curto -> 422
            r_us = http.post(f"{API}/auth/users", headers=_h(admin_token), json={
                "username": "ab", "password": "1234", "nome": "X", "role": "vendedor",
            })
            assert r_us.status_code == 422

            # PATCH - editar nome/cod
            p = http.patch(f"{API}/auth/users/{uid}", headers=_h(admin_token), json={
                "nome": "TEST Editado", "cod_vendedor": 888,
            })
            assert p.status_code == 200, p.text
            pd = p.json()
            assert pd["nome"] == "TEST Editado"
            assert pd["cod_vendedor"] == 888

            # LOGIN funciona
            lg = http.post(f"{API}/auth/login", json={"identifier": uname, "password": pw})
            assert lg.status_code == 200

            # RESET password
            newpw = "novaSenha!456"
            rp = http.post(f"{API}/auth/users/{uid}/reset-password", headers=_h(admin_token),
                           json={"new_password": newpw})
            assert rp.status_code == 200
            assert rp.json().get("ok") is True

            # Login antiga falha, nova funciona
            lg_old = http.post(f"{API}/auth/login", json={"identifier": uname, "password": pw})
            assert lg_old.status_code == 401
            lg_new = http.post(f"{API}/auth/login", json={"identifier": uname, "password": newpw})
            assert lg_new.status_code == 200

            # DESATIVAR
            d1 = http.patch(f"{API}/auth/users/{uid}", headers=_h(admin_token), json={"disabled": True})
            assert d1.status_code == 200
            assert d1.json()["disabled"] is True
            # Login bloqueado
            lg_dis = http.post(f"{API}/auth/login", json={"identifier": uname, "password": newpw})
            # login retorna token, mas /me deve rejeitar
            if lg_dis.status_code == 200:
                tok = lg_dis.json()["access_token"]
                me = http.get(f"{API}/auth/me", headers=_h(tok))
                assert me.status_code == 401
        finally:
            # cleanup: deixa desabilitado (nao ha delete endpoint)
            http.patch(f"{API}/auth/users/{uid}", headers=_h(admin_token), json={"disabled": True})

    def test_admin_cannot_disable_self(self, http, admin_token):
        # buscar id do admin
        users = http.get(f"{API}/auth/users", headers=_h(admin_token)).json()["users"]
        admin_row = next(u for u in users if u["username"] == "admin")
        # tenta desativar
        r = http.patch(f"{API}/auth/users/{admin_row['id']}", headers=_h(admin_token),
                       json={"disabled": True})
        assert r.status_code == 409
        # tenta rebaixar
        r2 = http.patch(f"{API}/auth/users/{admin_row['id']}", headers=_h(admin_token),
                        json={"role": "vendedor"})
        assert r2.status_code == 409


# ---------------------------------------------------------------------------
# Escopo: admin precisa ?vendedor= / vendedor ignora / cross-vendedor bloqueado
# ---------------------------------------------------------------------------
class TestScope:
    def test_admin_dashboard_requires_vendedor(self, http, admin_token):
        r = http.get(f"{API}/dashboard", headers=_h(admin_token))
        assert r.status_code == 400

    def test_admin_dashboard_with_vendedor(self, http, admin_token):
        r = http.get(f"{API}/dashboard?vendedor=204", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert d["total_clientes"] > 0
        # todos os clientes retornados sao do vendedor 204 (indiretamente
        # nao expoe cod_vendedor, mas total > 0 e valores plausiveis)
        assert "kpi" in d

    def test_vendedor_dashboard_ignores_param(self, http, vendedor_token):
        # mesmo passando vendedor= diferente, retorna dados do VAGNER
        r1 = http.get(f"{API}/dashboard", headers=_h(vendedor_token))
        r2 = http.get(f"{API}/dashboard?vendedor=999", headers=_h(vendedor_token))
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["total_clientes"] == r2.json()["total_clientes"]

    def test_vendedor_cannot_see_other_vendedor_client(self, http, vendedor_token, admin_token):
        # busca um cliente do vendedor 68 (que foi sincronizado no teste anterior)
        metas = http.get(f"{API}/admin/metas?vendedor=68", headers=_h(admin_token)).json()
        if not metas.get("clients"):
            pytest.skip("vendedor 68 sem clientes sincronizados")
        cod_outro = metas["clients"][0]["cod_cliente"]
        # VAGNER tentando ver -> 404
        r = http.get(f"{API}/clients/{cod_outro}", headers=_h(vendedor_token), timeout=30)
        assert r.status_code == 404
