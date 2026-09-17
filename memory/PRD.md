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

## Backlog
- P1: permitir configurar manualmente o total de dias úteis / mês de referência.
- P1: adicionar metas para clientes da planilha ausentes na carteira atual (admin).
- P2: gráfico Pareto de produtos por cliente (endpoint DW disponível).
- P2: migrar estilos shadow* → boxShadow (web).
- P2: cadastro de outros vendedores/gestores.

## Credenciais
Ver /app/memory/test_credentials.md
