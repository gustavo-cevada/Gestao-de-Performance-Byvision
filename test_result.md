#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: "Painel Administrativo (web/desktop) para o app Byvision: role admin, ver desempenho de TODOS os vendedores (27), editar metas por vendedor, gerenciar usuários (CRUD + reset senha). Mesmo MongoDB do app mobile."

## backend:
##   - task: "Admin: visão geral de vendedores (/api/admin/vendedores) + sync por vendedor e sync-all"
##     implemented: true
##     working: "NA"
##     file: "backend/server.py, backend/dw_client.py"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Novo endpoint agrega faturado/meta/status por vendedor. Sync profundo (12m) por vendedor em background com flag syncing. Escopo cod_vendedor adicionado a dashboard/crm/clients/metas."
##   - task: "Admin: gestão de usuários (GET/POST/PATCH /api/auth/users + reset-password)"
##     implemented: true
##     working: "NA"
##     file: "backend/auth.py"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "CRUD com bcrypt, dup username 409, bloqueio de auto-desativar/rebaixar admin logado, reset senha. Validado por curl (login/list/create/dup/patch/reset)."
##   - task: "Escopo por vendedor em dashboard/crm/clients (vendedor só vê própria carteira; admin passa ?vendedor=)"
##     implemented: true
##     working: "NA"
##     file: "backend/server.py"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Vendedor VAGNER continua funcionando (cod 204). Admin exige ?vendedor= nesses endpoints."

## frontend:
##   - task: "Tela Painel Admin (/admin): overview vendedores, sync, atalhos Metas/Usuários"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/admin.tsx"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Login admin redireciona para /admin. Smoke test OK (screenshot). Poll enquanto sincroniza."
##   - task: "Tela Gestão de Metas por vendedor (/admin/metas) com seletor de vendedor"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/admin/metas.tsx"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Seletor mostra apenas vendedores sincronizados. Salvar reflete no dashboard/overview."
##   - task: "Tela Usuários (/admin/users): CRUD + reset senha"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/admin/users.tsx"
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Modal criar/editar, toggle desativar, reset senha."
##   - task: "Detalhe de desempenho do vendedor (/admin/vendedor/[cod]) com filtro de mês"
##     implemented: true
##     working: "NA"
##     file: "frontend/app/admin/vendedor/[cod].tsx"
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Reusa endpoint /dashboard?vendedor=. Meses anteriores carregam via filtro."

## metadata:
##   created_by: "main_agent"
##   version: "1.1"
##   test_sequence: 1

## test_plan:
##   current_focus:
##     - "Admin: visão geral de vendedores (/api/admin/vendedores) + sync por vendedor e sync-all"
##     - "Admin: gestão de usuários (GET/POST/PATCH /api/auth/users + reset-password)"
##     - "Escopo por vendedor em dashboard/crm/clients"
##     - "Tela Painel Admin (/admin)"
##     - "Tela Gestão de Metas por vendedor"
##     - "Tela Usuários"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -comment: "Implementado painel admin multi-vendedor. Testar backend (endpoints admin, escopo, users CRUD) e frontend (login admin->/admin, overview, metas por vendedor, users CRUD, drill-down). Credenciais: admin/admin123, VAGNER/vagner123. VAGNER(204) já sincronizado; outros vendedores precisam de sync (botão) - NÃO disparar sync-all de todos os 27 no teste (pesado); testar sync de 1 vendedor pequeno é opcional."

## agent_communication:
##     -agent: "main"
##     -comment: "REFORMULAÇÃO TELA DO CLIENTE (client/[cod]): abaixo do card 'Ritmo da meta' (preservado) foi adicionado componente ClientAnalytics com dados REAIS da nova API. Backend: /api/clients/{cod} agora retorna pedidos[] (order-level c/ tipos), itens[] (item-level via novo dw.get_compras_itens → /clientes/{cod}/compras-itens, campos data/familia/codigo/sku/tipo(SURFACADO|ACABADO)/grupo/qtd/valor), meta_mensal, ref_month, ref_exp, dias_uteis_ref; janela de 13 meses. Seções: (1) Faturamento por mês com 4 indicadores (Faturamento do mês, Média de compra/mês [12m, meses c/ compra], Ticket médio de surfaçados [receita SURFACADO ÷ pedidos distintos no mês], Tendência [projeção por dias úteis vs média 3 meses, ±5%]) + gráfico mensal (barra, meta só no mês atual). (2) Faturamento por dia do mês selecionado (rolagem horizontal, meta diária = meta/dias úteis). (3) Produtos comprados no dia (ao tocar um dia). (4) Top produtos (janela independente 12/6/3/2/mês atual, topN editável, Ver todos). (5) Compras recentes com Tipo e ordenação (data/valor) + filtro (todos/surf/acab). TESTAR FRONTEND (VAGNER/vagner123 → abrir um cliente): tocar barra de mês atualiza indicadores + gráfico diário; tocar dia mostra 'Produtos comprados no dia'; trocar janela do Top produtos; digitar topN e 'Ver todos'; ordenar/filtrar Compras recentes. TESTAR BACKEND: GET /api/clients/{cod} retorna as chaves novas. Obs: API externa pode ter latência; itens/pedidos podem vir vazios se der timeout (degrada sem inventar). NÃO testar sync pesado." o POST /api/sync do vendedor rodava sync SÍNCRONO (uma chamada /clientes/{cod}/compras por cliente, ~210x) e a API nova dá ConnectTimeout frequente, estourando o timeout da requisição. CORRIGIDO: /api/sync agora dispara sync em BACKGROUND e retorna 200 imediatamente ({ok:true,syncing:true}) para vendedor e admin; connect timeout do dw_client reduzido p/ 8s. Frontend dashboard: onSuccess mostra 'Atualizando dados em segundo plano…' e reinvalida após 8s/25s (não mostra mais erro). TESTAR: (1) BACKEND POST /api/sync como VAGNER/vagner123 responde <2s com 200 e {syncing:true}; idem admin/admin123. (2) FRONTEND vendedor VAGNER: dashboard, acionar atualizar (pull-to-refresh no topo da lista OU botão de refresh se houver) → aparece toast 'Atualizando dados em segundo plano…' e NÃO aparece 'Falha ao atualizar dados'. Não é necessário aguardar o sync concluir (API externa é lenta). Sem regressões nas telas já existentes." (1) Dias úteis/feriados admin (coleção holidays; GET/POST/DELETE /api/admin/holidays) descontando feriados de dias uteis em /dashboard e /clients. (2) Metas ausentes: /admin/metas retorna sem_meta; /admin/vendedores retorna sem_meta por vendedor; UI banner+filtro+destaque. (3) purchase-bars nas telas de cliente. (4) razao_social+nome_fantasia no ClientRow (título+subtítulo). (5) filtro por dia lista só compradores (faturado>0). (6) Clientes em risco: backend _compute_at_risk + total_em_risco em /dashboard, cada cliente com at_risk/risk_reason; UI botão+contagem+mensagem na home E no admin/vendedor/[cod]. (7) Parametrização (GET /api/config público; PUT /api/admin/config admin) com labels + thresholds (yellow/green); frontend aplica labels e limiares de cor globalmente. (8) admin/vendedor/[cod] ganhou botão refresh (dispara /admin/vendedores/{cod}/sync) e filtro Clientes em risco. (9) 'Faturado %' e 'Previsionado %' na PerformanceSummary agora neutros (onSurface). TESTAR: backend endpoints holidays/config + escopo; frontend admin (parametrização salvar e refletir; dias-uteis; metas alerta; vendedor detalhe refresh+risco) e vendedor (VAGNER dashboard: subtítulo, filtro dia só compradores, botão Clientes em risco, gráfico de compras no cliente). Credenciais: admin/admin123, VAGNER/vagner123."
