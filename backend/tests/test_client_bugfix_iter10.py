"""Iteration 10 — validate BUG FIX (ticket médio surfaçados) + SERVICO classification.

Focus: /api/clients/{cod} for 3971, 7377, 5017 as VAGNER and admin.
- Items must not be duplicated (~30x inflation from broken pagination).
- Ticket médio de surfaçados must be realistic (dezenas/centenas de R$).
- Items should contain SURFACADO, ACABADO and SERVICO classification (no null service).
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CODS = ["3971", "7377", "5017"]


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http, identifier, password):
    r = http.post(f"{API}/auth/login", json={"identifier": identifier, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {identifier}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def vagner_tok(http):
    return _login(http, "VAGNER", "vagner123")


@pytest.fixture(scope="session")
def admin_tok(http):
    return _login(http, "admin", "admin123")


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def detail_3971_vagner(http, vagner_tok):
    r = http.get(f"{API}/clients/3971", headers=H(vagner_tok), timeout=120)
    assert r.status_code == 200, r.text
    return r.json()


class TestTicketMedioSurfacadosBug:
    """BUG: ticket médio de surfaçados inflado ~30x por duplicação de itens."""

    @pytest.mark.parametrize("cod", CODS)
    def test_client_returns_200_vagner(self, http, vagner_tok, cod):
        r = http.get(f"{API}/clients/{cod}", headers=H(vagner_tok), timeout=120)
        assert r.status_code == 200, f"{cod}: {r.status_code} {r.text[:400]}"

    @pytest.mark.parametrize("cod", CODS)
    def test_ticket_medio_realista(self, http, vagner_tok, cod):
        """ticket_medio deve ser dezenas ou centenas de reais, NÃO milhares.
        Bug antigo produzia valores ~30x inflados por duplicação de itens."""
        r = http.get(f"{API}/clients/{cod}", headers=H(vagner_tok), timeout=120)
        d = r.json()
        tm = float(d["cliente"].get("ticket_medio", 0.0))
        assert tm >= 0, f"{cod}: ticket_medio negativo? {tm}"
        # Sanidade: ótica típica tem ticket de dezenas a centenas de R$.
        # Se >5000, muito provavelmente a duplicação voltou.
        assert tm < 5000, f"{cod}: ticket_medio inflado (bug) = {tm}"

    def test_admin_and_vagner_same_for_3971(self, http, vagner_tok, admin_tok):
        r1 = http.get(f"{API}/clients/3971", headers=H(vagner_tok), timeout=120).json()
        r2 = http.get(f"{API}/clients/3971", headers=H(admin_tok), timeout=120).json()
        assert r1["cliente"]["cod_cliente"] == r2["cliente"]["cod_cliente"]
        # ticket_medio calculado a partir do cadastro (total_compras_rs/qtd_pedidos)
        assert abs(float(r1["cliente"]["ticket_medio"]) - float(r2["cliente"]["ticket_medio"])) < 0.01

    def test_3971_itens_count_no_duplication(self, detail_3971_vagner):
        """3971 tem ~925 itens reais; bug antigo repetia até ~19000."""
        n = len(detail_3971_vagner.get("itens", []))
        # Se o cache do cliente estiver pronto, deve ter itens; se vazio, o
        # detail cai no fallback compacto (pedidos indexados) e itens=[].
        # Não falhamos por 0 (cache pode ainda estar refrescando), mas
        # falhamos se estiver claramente duplicado.
        assert n < 5000, f"3971 tem itens duplicados? n={n}"


class TestClassificacaoServico:
    """Itens de serviço (Montagem/Coloração) devem vir como SERVICO, nunca null."""

    def test_tipos_presentes_3971(self, detail_3971_vagner):
        itens = detail_3971_vagner.get("itens", [])
        if not itens:
            pytest.skip("cache de 3971 ainda vazio; refresh em background")
        tipos = {(it.get("tipo") or "").upper() for it in itens}
        # Deve haver ao menos SURFACADO ou ACABADO (o cliente é uma ótica)
        assert (tipos & {"SURFACADO", "ACABADO"}), f"tipos encontrados: {tipos}"
        # CRITICO: nenhum item pode ter tipo null/vazio agora que temos SERVICO/CONFERIR
        vazios = [it for it in itens if not (it.get("tipo") or "").strip()]
        assert not vazios, f"{len(vazios)} itens com tipo vazio (esperado SERVICO/CONFERIR)"

    def test_servicos_classificados(self, detail_3971_vagner):
        itens = detail_3971_vagner.get("itens", [])
        if not itens:
            pytest.skip("cache 3971 vazio")
        servicos = [it for it in itens if (it.get("tipo") or "").upper() == "SERVICO"]
        # Se há grupo=SERVICO no cadastro, deve aparecer classificado
        if any("SERVIC" in ((it.get("grupo") or "").upper().replace("Ç", "C")) for it in itens):
            assert servicos, "há grupo=SERVICOS mas nenhum item classificado como SERVICO"


class TestShapeForFrontend:
    """Estruturas usadas pela nova client-analytics."""

    def test_pedidos_tem_tipos_lista(self, detail_3971_vagner):
        for p in detail_3971_vagner.get("pedidos", [])[:5]:
            assert isinstance(p.get("tipos"), list)

    def test_period_as_of(self, detail_3971_vagner):
        # asOf usado pelo frontend para limitar dias renderizados no mês atual
        per = detail_3971_vagner.get("period") or {}
        assert per.get("as_of"), "period.as_of ausente — necessário para dailyBars sem futuro"
