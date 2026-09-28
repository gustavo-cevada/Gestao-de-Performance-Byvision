# PRD — Gestão de Performance de Vendas Byvision

## Problema original
App mobile (com acesso web/desktop) para vendedores da Byvision acompanharem metas mensais e desempenho por cliente: vendas realizadas em tempo real, venda provisionada (ritmo para bater a meta), Gap (R$ e %), % atingimento provisionado x realizado, filtro por cidade, e lista de clientes com meta individual (definida por admin) + faturamento + barra de atingimento. Identidade clara com verde #00aa79 e tema escuro opcional. Logo Byvision visível. Perfil do vendedor VAGNER (cod 204) com seus clientes reais via API do Data Warehouse.

## Arquitetura
- **Frontend:** Expo SDK 57 + expo-router, react-query, react-native-svg (anel), @react-native-vector-icons/material-design-icons, fontes Plus Jakarta Sans + Space Grotesk. Tema claro/escuro (src/theme.ts) com toggle persistido.
- **Backend:** FastAPI + MongoDB (motor). Auth JWT custom (bcrypt). Proxy da API externa DW (audaxccrm.duckdns.org:9443) via id_responsavel=1 filtrando cod_vendedor=204. Cache de clientes + faturamento do mês em Mongo. Metas por cliente em coleção própria (seed da planilha).
- **Cálculos:** dias úteis do mês automáticos; provisionado = meta × (dias úteis decorridos / total); gap = provisionado − realizado.

## Personas
- Vendedor (VAGNER): vê seu painel e clientes.
- Admin: define/edita metas por cliente.

## Implementado (2026-06)
- Login (VAGNER/vagner123, admin/admin123) com RBAC.
- Dashboard: anel de progresso realizado x previsto, 4 KPIs, filtro por cidade (chips) recalculando cards, lista de clientes com barra de atingimento.
- Detalhe do cliente: info, meta x faturado, faturamento mensal, compras recentes.
- Painel admin de metas com soma total em tempo real e salvar.
- Configurações: tema claro/escuro/sistema, logout.
- Sync manual (botão atualizar) com a API DW.

### Iteração 2 (2026-06)
- Lógica de RITMO por dias úteis em cada cliente (meta esperada até hoje, % no ritmo, barra com marcador do "ideal hoje" + faixa de déficit, gap % e R$, meta/dia necessária).
- Ordenação padrão por maior atingimento; opções: maior/menor atingimento, mais/menos vendido.
- Filtro de período: por mês (recalcula meta/vendas do mês) e por dia específico (resume tudo ao dia: meta do dia, provisionado do dia, gap), com botão "Limpar filtro".
- "Meta do dia" (quanto vender por dia útil restante) exibida no hero.
- Sync agora guarda janela de 12 meses de compras faturadas para filtro por mês/dia instantâneo.

### Iteração 3 (2026-06) — CRM & Ranking
- Menu sanduíche (drawer) no cabeçalho do painel: navega para Painel, CRM & Ranking, Gestão de Metas (admin), Configurações, Sair.
- Nova aba CRM (/crm): ranking geral dos clientes por faturamento 12 meses, com acompanhamento de movimento (subiu/desceu/sumiu/novo comparando mês atual x anterior).
- Status derivado: ATIVO / PRÉ-INATIVO (>=45 dias sem compra) / INATIVO (status INATIVO ou >=90 dias).
- Cards resumo: Total, Ativos, Pré-inativos, Inativos (com %).
- Filtros: Cidade, Cliente (código), Status; busca por nome, cidade ou CNPJ (só dígitos).
- Tabela: Cliente (nome + #código + rank/movimento), Cidade, dias s/ compra, status.
- Perfil do cliente (/crm/[cod]): avatar, status, cidade, Última compra, Ticket médio, Faturamento acumulado, Faturamento 12 meses, histórico de compras (gráfico) e últimos pedidos.
- Backend: endpoint /api/crm e campos CRM (status_crm, ticket_medio, faturamento_12m) em /api/clients/{cod}.

## Ajustes recentes (UI + CRM)
- Dashboard: gráfico "hero" agora mostra dois percentuais lado a lado — Faturado (colorido por regra) e Previsionado (cinza) — com barra segmentada (faturado forte + provisionado claro + restante) e "Falta R$ X para 100% da meta". Cards renomeados: "Faturado" e "Provisionado".
- Header: logo Byvision fixa no topo de todas as abas (padrão), inclusive telas com botão voltar.
- Filtros selecionados (chips Ordenar/cidade): cor de seleção usa onSurface (preto no claro / branco no escuro) em vez de verde.
- CRM: corrigida a lógica de variação de ranking. Antes o rank exibido (12m) divergia do delta (mensal), gerando "#1 caiu N". Agora o delta compara o ranking 12m atual vs. o mesmo ranking excluindo o mês de referência (posição no fim do mês passado): delta = posição_anterior - posição_atual (positivo=subiu). Verificado: #1 nunca "desceu".

## CRM — status e filtro por quadro
- Badges de status na lista viraram pílulas contornadas (texto colorido + borda, maiúsculas): ATIVO/PRÉ-INATIVO/INATIVO.
- Quadros de resumo (Total/Ativos/Pré-inativos/Inativos) são clicáveis e aplicam o filtro de status (toggle; Total limpa). Resumo calculado ignorando o filtro de status para manter os quadros informativos.

## Backlog
- P1: adicionar metas para clientes da planilha ausentes na carteira atual (admin).
- P2: gráfico Pareto de produtos por cliente (endpoint DW disponível).
- P2: migrar estilos shadow* → boxShadow (web).
- P2: cadastro de outros vendedores/gestores.

## Credenciais
Ver /app/memory/test_credentials.md

### Iteração 4 (2026-06) — Painel Administrativo (multi-vendedor)
- Área Admin (web/desktop) no mesmo app Expo, protegida por role=admin, mesmo MongoDB (reflete em tempo real).
- Login admin passa a redirecionar para /admin (não mais /dashboard). Menu lateral específico por cargo.
- /admin: visão geral de TODOS os vendedores (API DW = 27) com faturado/meta/% do mês (cor por ritmo), contagem de clientes e status (ativos/pré/inativos). Botão "Sincronizar" por vendedor (sync profundo 12m em background, com polling) e "Sincronizar todos". Atalhos para Metas e Usuários.
- /admin/vendedor/[cod]: drill-down no desempenho do vendedor (hero + KPIs + lista de clientes) com filtro de período (meses anteriores carregam via janela 12m do sync).
- /admin/metas: gestão de metas com seletor de vendedor (apenas sincronizados).
- /admin/users: CRUD de usuários (criar/editar cargo+cod_vendedor+email, ativar/desativar, redefinir senha). Bloqueio de auto-desativar/rebaixar o próprio admin.
- Backend: /api/admin/vendedores, /api/admin/vendedores/{cod}/sync, /api/admin/vendedores/sync-all; /api/auth/users (GET/POST/PATCH) e /users/{id}/reset-password. dashboard/crm/clients/metas passam a ter escopo por cod_vendedor (vendedor só vê sua carteira; admin usa ?vendedor=). Clientes agora gravam cod_vendedor; sync generalizado por vendedor com paginação (>500 clientes).
- Testado (backend + frontend) pelo testing agent: sem bugs. Backlog remanescente: migrar shadow* → boxShadow.

### Iteração 5 (2026-06) — Link/entrada dedicada do Admin (desktop)
- Acesso admin agora tem entrada própria em `.../admin` que abre uma TELA DE LOGIN DO ADMIN (layout desktop split: painel de marca à esquerda + card de login à direita; empilha no mobile). Componente: frontend/src/components/admin-login.tsx.
- Mesmo app/deploy e mesmo banco: apenas o caminho/URL e a aparência da entrada mudam. Vendedores continuam usando `/login` (app).
- Login do admin valida o cargo: se a conta não for admin, faz logout e mostra "sem acesso administrativo".
- auth.login() agora retorna { user, error } (login.tsx atualizado). Regressão do login de vendedor verificada (VAGNER -> /dashboard).

### Iteração 6 (2026-06) — Redesenho da tela inicial (dashboard) + paridade no admin
- Tela inicial reformulada conforme imagem de referência do usuário:
  - 3 cards de percentual no topo: Faturado %, Previsionado %, Gap falta (%) (com sinal +/-).
  - Card "Progresso da Meta de Vendas" com título e barra MAIS GROSSA (26px, cantos levemente arredondados 6px). Segmentos: faturado (sólido) + previsionado (claro) + restante (cinza).
  - Bloco "META DE VENDAS DO MÊS" com valor, dias úteis e pílula "Meta do dia".
  - Grade de 4 KPIs: Faturado, Previsionado, Gap (falta) R$ (valor com sinal, ex.: R$ -31.318,15) e "Falta para a meta" (com ícone flag). Removido o antigo card "Gap (%)" (virou o 3º card de percentual no topo).
  - Cores seguem a regra de ritmo (<76% vermelho, 76-99% amarelo, >=100% verde) em: Faturado %, Gap %, Gap R$ e barra. Previsionado neutro.
- Componentes compartilhados criados: src/components/performance-summary.tsx e src/components/sort-chips.tsx (reutilizados no dashboard do vendedor e no detalhe do admin).
- ADMIN: /admin/vendedor/[cod] agora tem PARIDADE TOTAL com o dashboard — inclui "Ordenar clientes" (chips), busca de cliente, filtro por cidade e a "Meta do dia" do vendedor. Nada fica oculto no painel admin.
- Testado (frontend) pelo testing agent: sem bugs. Backlog: limpar estilos órfãos em dashboard.tsx (opcional) e migrar shadow* -> boxShadow (P2).

### Iteração 7 (2026-06) — Dias úteis, metas ausentes, gráfico de compras, subtítulo, filtro por dia e Clientes em risco
- **Dias úteis configuráveis (admin):** nova tela `/admin/dias-uteis` (menu + atalho no painel) para cadastrar feriados (data + descrição). Feriados em dias de semana reduzem os dias úteis do mês, deixando o cálculo de ritmo/provisionado mais preciso. Backend: coleção `holidays`; endpoints `GET/POST /api/admin/holidays`, `DELETE /api/admin/holidays/{date}`. `dashboard` e `clients/{cod}` passam a descontar feriados de total/decorridos.
- **Alerta de metas ausentes (admin):** `/admin/metas` mostra banner "X cliente(s) sem meta definida" (toggle para filtrar só os sem meta) + destaque (borda âmbar + ícone) nas linhas sem meta. Painel de vendedores mostra "N cliente(s) sem meta definida" por vendedor. Backend: `admin/metas` retorna `sem_meta`; `admin/vendedores` retorna `sem_meta` por vendedor.
- **Gráfico de compras (cliente):** novo componente `src/components/purchase-bars.tsx` — cada compra recente vira uma barra horizontal proporcional (100% = maior pedido do período), com o valor na mesma cor da barra e um fundo sólido clarinha atrás (translúcido: claro no tema escuro, escuro no tema claro). Aplicado em `client/[cod]` (Compras recentes) e `crm/[cod]` (Últimos pedidos).
- **Subtítulo na lista (home):** `ClientRow` mostra a razão social em destaque (título) e o nome fantasia como subtítulo (menos destaque, maiúsculas). Backend passa `razao_social` e `nome_fantasia`.
- **Filtro por dia = só compradores:** ao filtrar por um dia específico, o dashboard lista apenas clientes que compraram naquele dia (independente de ter meta). `total_clientes` reflete a lista filtrada.
- **Clientes em risco (home):** botão "Clientes em risco" (com contagem) ao lado de "Clientes (N)". Ao ativar, filtra só clientes em queda de curto prazo e mostra "Você tem X cliente(s) em risco de queda". Lógica no backend (`_compute_at_risk`): projeta o mês corrente pelo ritmo dos dias úteis e compara com a base recente (2 últimos meses); sinaliza risco por queda projetada no mês atual, tendência de 3 meses em queda, ou queda recente acentuada. Cada cliente recebe `at_risk`/`risk_reason`; dashboard retorna `total_em_risco`. `ClientRow` exibe tag "Em risco de queda". Também presente no admin (detalhe do vendedor).
- **Parametrização (admin):** menu + atalho `/admin/parametrizacao`. Backend `GET /api/config` (público) e `PUT /api/admin/config` (admin) guardam `labels` (textos dos dashboards) e `thresholds` (limiares de cor amarelo/verde do ritmo). Frontend usa `src/context/config.tsx` (ConfigProvider + useLabels/usePaceTone/usePaceToneKey) para aplicar textos e regra de cores globalmente para todos os vendedores. Tela com prévia das faixas de cor.
- **Paridade admin + refresh:** `/admin/vendedor/[cod]` ganhou botão de atualizar no cabeçalho (dispara sync do vendedor em background) e o filtro "Clientes em risco".
- **% neutro:** os cartões de percentual "Faturado" e "Previsionado" na `PerformanceSummary` ficam em cor neutra (branco no tema escuro / cinza escuro no claro). A regra de cores continua em Gap %, Gap R$ e na barra.

### Backlog / pendente
- Iteração 7.1: rótulos da Parametrização agora propagam para TODAS as telas (mesma chave por conceito): tela do cliente (`Ritmo da meta`→title_ritmo, `Faturado`→kpi_faturado, `Previsionado`→kpi_previsionado, `Meta do mês`→metric_meta_mes, `Meta/dia`→metric_meta_dia) e cards de vendedor/cliente-row (`Faturado`/`Meta/dia`). Novo `metric_saldo_mes` ("Saldo/mês (R$)") exibido na tela do cliente = max(0, meta−faturado). ConfigProvider revalida (staleTime 0 + refetchOnMount/onWindowFocus) para refletir mudanças sem reload.
- P2: migrar `shadow*` → `boxShadow`; limpar estilos órfãos em dashboard.tsx.
- P2 (backlog anterior): contato rápido (WhatsApp), metas em massa, gráfico de produtos por cliente, pódio de vendedores.

### Atraso/dados incompletos ao abrir cliente (2026-06) — CORRIGIDO
- **Causa raiz:** no sync em lote (`compras_window`), a API Audax (9443) instável dava timeout para muitos clientes; `_compras_f_list` engolia o erro e retornava `[]`, gravando `compras_f` vazio (apagando histórico). Sem retry e sem distinguir "sem compras" de "falha". Resultado: 67% da base (1596/2394) com `compras_f` vazio; ao abrir, a tela ficava sem histórico até o fetch preguiçoso em 2º plano popular o cache — daí o atraso.
- **Correção (3 pontos):**
  1. **Sync resiliente:** `_compras_f_list` agora levanta exceção (não mascara); `_compras_f_retry` faz 3 tentativas com backoff (0.5/1/2s). `compras_window` retorna `{cod: list | None}` (None = falhou). `run_vendedor_sync` NUNCA sobrescreve `compras_f` com vazio quando falha — preserva o último dado bom e marca `sync_pending=True`.
  2. **Gap-fill em 2º plano:** `run_gap_fill(cod_vendedor)` reprocessa em passadas (3) só os `sync_pending=True`, preenchendo até completar. Disparado ao fim de cada `run_vendedor_sync` via `create_task`.
  3. **Menos carga na API:** read-timeout 20→45s; concorrência do `compras_window` 10→5 workers.
- **Heal aplicado ao VAGNER (204):** 29 clientes furados → 12 curados com dado real; 17 restantes são genuinamente antigos (última compra fora da janela de 12m → 0 correto, marcados como não-pendentes). Validado: `GET /api/clients/5399` retorna 13 meses e 40 pedidos instantâneo. Demais vendedores curam automaticamente no próximo "Sincronizar".
- Tela CRM (`/crm`) ganhou botão "Exportar" (ao lado da contagem de clientes) que gera um CSV da lista **filtrada** (respeita cidade/cliente/status/busca).
- Colunas: Rank, Código, Cliente, CNPJ, Cidade, UF, Dias sem compra, Status, Movimento, Faturamento 12m.
- Cross-platform: helper `src/lib/export-csv.ts`. Web dispara download; nativo grava no cache (expo-file-system) e abre o compartilhamento (expo-sharing). CSV com BOM (acentos no Excel) e delimitador ";" (padrão pt-BR).

### Integração externa — atualização de contrato (Audax CRM API / SGO)
- Nova base URL/chave já em backend/.env (DW_API_URL=https://audaxccrm.duckdns.org:9443, DW_API_KEY).
- dw_client.py atualizado ao novo contrato:
  - Endpoint /vendedores foi REMOVIDO. Lista de vendedores agora é derivada agregando GET /clientes por cod_vendedor (nome/ativo/qt_clientes). Novo helper _all_clientes() pagina todos os clientes.
  - /health não traz mais dm_valorcompra_ultima. periodo_referencia agora usa a data de geração do cache: /status.cache_generated_at -> /health.generated_at -> data local (_as_of_date). get_health passou a enviar X-API-Key; novo get_status (sem chave).
  - get_clientes(cod_vendedor), get_compras e cálculo de faturado (situacao_pedido=='F', data_baixa) seguem compatíveis. /clientes já retorna razao_social/nome_fantasia (subtítulo) e tipo_cadastro; /clientes/{cod}/compras traz cod_vendedor_venda (não usado ainda).
- AÇÃO do usuário: rodar "Sincronizar todos" no admin para repovoar vendedores/clientes com o novo contrato (a 1ª sincronização de lista é mais pesada). Testes com a API real serão feitos pelo próprio usuário.

### Reformulação da tela do cliente — status
- Bug do Refresh (vendedor "Falha ao atualizar dados") CORRIGIDO: POST /api/sync agora roda em background (retorna 200 na hora); connect timeout do dw_client = 8s. Testado pelo testing agent (iteration_7.json / test_sync_bugfix.py).
- Documento de integração `/app/memory/CLIENTE_DETALHE_INTEGRACAO.md` EXPANDIDO com as respostas do usuário: seção 7 (spec para a equipe da API: endpoint de itens por pedido/dia com `tipo` surfaçado/acabado, campo de classificação, janelas do Top produtos, regras de reconciliação devolução/CFOP, relação família↔código, meta só no mês atual, performance porta 9443) e seção 8 (perguntas abertas para a API).
- Bloco construível com dados em cache (indicadores mês, média, tendência, faturamento por dia com meta diária, seleção de mês) AGUARDANDO decisão do usuário (msg de escopo). Bloco de produtos bloqueado até a API criar os endpoints/estabilizar a porta 9443.

### Ajustes tela do cliente (2026-06, fork) — implementados
- **Bug crítico ticket médio (RAIZ):** o endpoint externo `/clientes/{cod}/compras-itens` NÃO pagina (ignora `page`/`page_size` e devolve TODOS os itens em 1 resposta). O loop de paginação em `dw.get_compras_itens` repetia a mesma lista ~30× (guard-rail page>30), inflando o numerador do ticket médio de surfaçados (ex.: cod 3971 set/2026 mostrava R$5.834; correto R$164). Denominador (pedidos distintos) não inflava por ser `set`, logo o ticket saía ~30× maior. CORRIGIDO: `get_compras_itens` faz apenas 1 chamada. Cache existente (13 docs) reprocessado (ex.: 15570→519 itens). Ticket recalculado: 3971=R$164, 7377=R$183, 5017=R$263.
- **Classificação de itens (Serviço/Conferir):** novo `classify_item()` no backend, fonte = campos da API. `tipo`=SURFACADO/ACABADO; sem tipo mas `grupo` contém "SERVIC" → SERVICO (cobre Montagem, Coloração e futuros serviços); sem classificação identificável → CONFERIR (sinaliza p/ conferência, não presume). `itens_out.tipo` e `pedidos.tipos` usam a classificação canônica. Frontend: `tipoLabel` mostra Surfaçado/Acabado/Serviço/Conferir; `tipoColor` (surf=brand, acab=warning, serviço=neutro, conferir=erro). Serviços agora APARECEM nas listas (produtos do dia, top produtos, compras recentes) — removido o filtro `isService` antigo.
- **Nomes completos:** removida a função `abbreviate` (Byv/Blue/AR/Freeform). "Produtos comprados no dia" e "Top produtos" agora usam `ProductTable` com rolagem horizontal (colunas Tipo | Produto (nome completo, quebra linha) | Qtd (UN) | Total (R$)), código menor abaixo do nome, cabeçalho alinhado. Rolagem horizontal não bloqueia scroll vertical da página (ScrollView horizontal + nestedScrollEnabled).
- **Posição inicial dos gráficos:** gráfico mensal inicia no mês atual (scrollToEnd no mount); gráfico diário inicia no dia mais recente disponível (scrollToEnd no mount e ao trocar mês). Não renderiza dias futuros do mês corrente (limita ao `period.as_of` passado como prop `asOf`); meses passados vão até o último dia do mês.
- Ticket médio null → rótulo "Sem pedidos surfaçados" (sem divisão por zero).
- Cabeçalho: nome fantasia (título) + razão social (subtítulo pequeno) + badge de status colorido (Ativo/Pré-inativo/Inativo) no canto superior direito, reutilizando STATUS_META do CRM.
- Faturamento por dia: apenas dias úteis (+ dias não úteis com faturamento); linha de meta diária CONTÍNUA (overlay horizontal) atravessando o gráfico; removida a barra de rolagem (showsHorizontalScrollIndicator=false, só toque).
- Serviços (Montagem/Serviço/Mão de obra) filtrados das listas de produtos (isService) em "Produtos do dia" e "Top produtos".
- Robustez/performance: GET /api/clients/{cod} não bloqueia mais. Dinheiro (mês/dia/recentes) vem do compras_f já sincronizado (compacto {d,v}) → instantâneo. Itens/pedidos detalhados (tipos, produtos) vêm de db.client_cache atualizado em SEGUNDO PLANO (create_task); se a API pesada estiver lenta/fora (porta 9443), a tela abre na hora e as seções de produtos ficam vazias (sem dados fictícios) até o cache popular. dw_client _TIMEOUT=(8,20).
