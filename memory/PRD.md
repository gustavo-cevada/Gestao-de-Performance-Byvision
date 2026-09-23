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
