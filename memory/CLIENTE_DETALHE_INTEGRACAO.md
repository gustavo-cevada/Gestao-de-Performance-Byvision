# Reformulação da tela de Detalhe do Cliente — Disponibilidade de dados & fórmulas

Fonte: Audax CRM API (SGO) — API_DOCS.md. Analisado o contrato atual dos endpoints
`/clientes/{cod}/compras`, `/produtos/top`, `/produtos/vendas-detalhadas`.

## 1) O que É POSSÍVEL com dados reais hoje

| Item do pedido | Fonte | Observação |
|---|---|---|
| **Faturamento por mês** (gráfico) | `/clientes/{cod}/compras` (nível pedido, `situacao_pedido='F'`, `data_baixa`, `cfop`) | Já existe hoje; soma por mês. |
| **Faturamento do mês** (indicador) | idem | Soma dos pedidos faturados do mês. |
| **Média de compra/mês** (indicador) | idem (janela histórica) | Fórmula proposta abaixo (não há definição comercial pré-existente no app). |
| **Tendência** (indicador) | idem | Fórmula proposta abaixo (usa projeção por dias úteis no mês parcial). |
| **Faturamento por dia** (gráfico) | idem (`data_baixa` = dia) | Uma barra por dia do calendário; meta diária = meta_mensal ÷ dias úteis (respeita feriados). |
| **Top produtos mais vendidos** | `/produtos/vendas-detalhadas?cod_cliente=X&mes=YYYY-MM` | Família (`familia_produto`), código (`codigo_chave`/`sku`), `grupo`, `quantidade`, `receita_total`. Ordena por Total (R$). *Ver ressalva de janela histórica abaixo.* |

## 2) O que está BLOQUEADO por lacuna da API (precisa de decisão/novo dado)

### (a) Classificação **surfaçado x acabado** — NÃO existe na API
- `/produtos/vendas-detalhadas` traz `grupo` (ex.: UNIFOCAL, MULTIFOCAL) e `tipo_producao`
  (ex.: `BLOCO_ATACADO`), mas **nenhum campo "surfaçado/acabado"**.
- Impacto: "Ticket médio de surfaçados", coluna **Tipo** em "Produtos comprados no dia",
  "Top produtos" (Tipo) e o **Tipo** em "Compras recentes".
- **Preciso de:** o mapeamento oficial → quais valores de `tipo_producao`/`grupo` são
  "surfaçado" e quais são "acabado"; OU a API expor um campo `tipo` (surfaçado/acabado).

### (b) Produtos por **DIA** e por **PEDIDO** — NÃO existem na API
- `/clientes/{cod}/compras` é **nível de pedido** (sem itens/produtos).
- `/produtos/vendas-detalhadas` é **agregado por MÊS** (`mes`), **sem `id_pedido` e sem dia**.
- Impacto (bloqueia):
  - **"Produtos comprados no dia"** (precisa produto por data).
  - **"Ticket médio de surfaçados"** (precisa nº de **pedidos distintos** que contêm surfaçados no mês → exige vínculo produto↔pedido).
  - **"Tipo" em cada pedido de "Compras recentes"** (precisa vínculo produto↔pedido).
- **Preciso de:** um endpoint de **itens por pedido/dia**, por ex.:
  `GET /clientes/{cod}/compras?detalhado=true` retornando, por item:
  `{ id_pedido, data_baixa, sku, familia_produto, codigo_chave, tipo(surfaçado|acabado), quantidade, valor }`.

### (c) **Histórico de metas mensais** — não há na API nem no app
- Hoje guardamos **1 meta por cliente** (meta atual), não meta por mês.
- Impacto: "meta de cada mês" no gráfico mensal.
- **Opções:** (1) usar a meta atual como referência em todos os meses; (2) mostrar meta só no mês de referência e "Sem meta cadastrada" nos demais; (3) passar a **armazenar histórico de metas por mês** (criar no admin).

### (d) Profundidade histórica de `/produtos/vendas-detalhadas`
- A resposta indica `periodo_meses` (ex.: 3) e `periodo_inicio/fim` ~ últimos 3 meses.
- Para "Top produtos — últimos 12 meses" preciso confirmar se a API entrega **12 meses**
  (ou até quantos meses o cache cobre).

## 3) Fórmulas propostas (para documentar antes de implementar)

**Média de compra/mês** — não há definição comercial no app; proposta:
> Média = (soma do faturamento faturado dos últimos **12 meses completos**, anteriores ao mês
> de referência) ÷ (nº de meses **com compra > 0** nessa janela). Exibir a janela na UI:
> "média dos últimos 12 meses (N meses com compra)". Exclui o mês corrente parcial.

**Tendência** — proposta (consistente com a lógica de "clientes em risco"):
> - Mês **corrente/parcial**: projeta pelo ritmo de dias úteis → `proj = faturado_atual ÷ (dias_uteis_decorridos ÷ dias_uteis_totais)`; compara `proj` com a **média dos 3 meses completos anteriores** (base). Variação% = (proj − base) ÷ base.
> - Mês **fechado** (selecionado no gráfico): compara o mês selecionado com a média dos **3 meses imediatamente anteriores**.
> - Classificação: **crescimento** se > +5%, **queda** se < −5%, **estável** entre −5% e +5%.
> - Exibir % e o período de comparação (ex.: "vs média dos 3 meses anteriores (projeção)").

## 5) Decisões do usuário (2026-09) e ações para a equipe da API

- **Surfaçado x Acabado:** virá na API no campo **`grupo`** ou **`tipo`**, com valores como
  `Surfaçado`, `Acabada`, `Multifocal`, etc. → **AÇÃO API:** expor esse campo de classificação
  em `/produtos/vendas-detalhadas` (e no endpoint detalhado por pedido — ver abaixo). No app,
  a leitura será por `tipo`/`grupo`; enquanto os valores não vierem, "Ticket médio de surfaçados"
  e a coluna "Tipo" ficam sem dados (mostrar "—"), sem inventar.
- **AÇÃO API (novo endpoint de itens por pedido/dia):** criar
  `GET /clientes/{cod}/compras?detalhado=true` (ou `/clientes/{cod}/itens`) retornando, por item:
  `{ id_pedido, data_baixa (dia), sku, familia_produto, codigo_chave, tipo (surfaçado|acabado),
  grupo, quantidade, valor }`. Sem isso ficam **bloqueados**: "Produtos comprados no dia",
  "Ticket médio de surfaçados" (nº de pedidos distintos com surfaçados) e "Tipo" em "Compras recentes".
- **Meta por mês:** decidido **mostrar meta só no mês atual** e "Sem meta cadastrada" nos demais.
- **Fórmulas de Média/mês e Tendência:** APROVADAS (seção 3).
- **Top produtos — 12 meses:** **NÃO foi possível validar** — o endpoint
  `/produtos/vendas-detalhadas` está **dando timeout** a partir do nosso ambiente (ver seção 6).
  Assim que responder, confirmar se cobre 12 meses; se cobrir só ~3 (periodo_meses=3), limitar as
  janelas do ranking ao que a API entregar e avisar na UI.

## 6) Bug reportado: Refresh → "FALHA AO ATUALIZAR DADOS" (CAUSA & CORREÇÃO)

**Causa raiz:** o endpoint `POST /api/sync` (botão atualizar do vendedor) executava a
sincronização de forma **síncrona**, buscando `/clientes/{cod}/compras` **um por cliente**
(≈210 clientes do vendedor). Na API nova, essas chamadas por cliente frequentemente dão
**ConnectTimeout (~30s cada)**; somadas, a sincronização levava minutos e a requisição do app
estourava o timeout → HTTP falho → toast "Falha ao atualizar dados".

**Correção aplicada:**
- `POST /api/sync` agora dispara a sincronização em **segundo plano** (retorna `200` imediatamente,
  `{ok:true, syncing:true}`), igual ao fluxo do admin. O app mostra "Atualizando dados em segundo
  plano…" e recarrega automaticamente depois de alguns segundos. Sem mais erro de timeout.
- `connect timeout` reduzido para 8s (antes 30s) para falhar rápido em host instável.

**Observação de infraestrutura (AÇÃO API/rede):** do nosso ambiente, `GET /status` e `GET /health`
respondem (200), mas os endpoints "pesados" — `/clientes/{cod}/compras` e
`/produtos/vendas-detalhadas` — frequentemente dão **timeout de conexão na porta 9443**. Isso
impacta a sincronização (fica lenta/incompleta) e impede validar as seções de produtos com dados
reais agora. Verificar do lado da API/firewall a latência/limite na porta 9443 para esses endpoints.

---

## 7) ESPECIFICAÇÃO PARA A EQUIPE DA API (consolidada com as decisões do usuário)

> Esta seção reúne TUDO que a API precisa criar/alterar para a nova tela de detalhe do cliente,
> já considerando as respostas do usuário. Cada item indica o(s) recurso(s) do app que depende(m) dele.

### 7.1 NOVO endpoint — itens por pedido/dia  ⟵ desbloqueia 3 seções
`GET /clientes/{cod}/compras-itens?desde=YYYY-MM-DD` (ou `GET /clientes/{cod}/compras?detalhado=true`)

Deve retornar **uma linha por ITEM de pedido** (não por pedido), com granularidade de **dia** e
com o `id_pedido` preservado (para agrupar por pedido). Exemplo de resposta:
```json
{
  "itens": [
    {
      "id_pedido": 182584,
      "data_baixa": "2026-09-22T00:00:00",
      "situacao_pedido": "F",
      "cfop": "6.102",
      "sku": "150SOHN4100D",
      "codigo_chave": "10420",
      "familia_produto": "1.50 ESPACE ORMA HMC AR VERDE",
      "grupo": "MULTIFOCAL",
      "tipo": "SURFACADO",
      "quantidade": 3.0,
      "valor": 82.5
    }
  ]
}
```
Campos obrigatórios e tipos: `id_pedido` (int), `data_baixa` (date/datetime), `situacao_pedido`
(str, 'F'=faturado), `cfop` (str), `sku` (str), `codigo_chave` (str), `familia_produto` (str),
`grupo` (str), **`tipo` (str: SURFACADO|ACABADO)**, `quantidade` (number), `valor` (number, já
líquido de devolução/cancelamento — ver 7.4).

**Recursos do app que dependem deste endpoint:**
- **Produtos comprados no dia** (linha por família na data tocada): usa `data_baixa`, `familia_produto`, `codigo_chave`, `tipo`, `quantidade`, `valor`.
- **Ticket médio de surfaçados** (por mês): numerador = soma de `valor` dos itens com `tipo=SURFACADO` no mês; denominador = nº de **`id_pedido` distintos** que contêm ao menos um item `tipo=SURFACADO` no mês. (Não incluir no numerador o valor de itens ACABADO do mesmo pedido.)
- **Tipo em "Compras recentes"** (por pedido): agrupar itens por `id_pedido` e listar TODOS os `tipo` presentes (um pedido pode ter surfaçado e acabado ao mesmo tempo).

### 7.2 Campo de classificação `tipo` (Surfaçado/Acabado)  ⟵ decisão do usuário
O usuário confirmou que a classificação virá em **`grupo`** ou **`tipo`**, com valores como
`Surfaçado`, `Acabado`, `Multifocal`, `Unifocal`, etc.
**AÇÃO API:** expor esse campo `tipo` (surfaçado/acabado) **tanto** no endpoint novo (7.1) **quanto** em
`/produtos/vendas-detalhadas`. **Precisamos da lista COMPLETA dos valores possíveis** e de qual valor
mapeia para surfaçado e qual para acabado (ex.: `SURFACADO`, `ACABADO`; e como se relacionam com
`grupo`=UNIFOCAL/MULTIFOCAL). Enquanto o campo não vier, o app exibe "—" nesses pontos (sem inventar).

### 7.3 Top produtos por cliente — janelas móveis  ⟵ seção "Top produtos mais vendidos"
`GET /produtos/vendas-detalhadas?cod_cliente={cod}&...` precisa suportar janelas de
**12, 6, 3, 2 meses e mês atual**, como janelas móveis até a data de referência.
- Hoje a resposta traz `periodo_meses` (aparentemente fixo ~3) e filtro `mes`.
- **AÇÃO API:** confirmar se há **12 meses** de histórico consultável (por `mes` repetido ou por um
  parâmetro `meses=12`/`desde`&`ate`). Se só houver ~3 meses, informar o limite — o app vai restringir
  as opções do ranking ao que existir e avisar na UI.
- Campos usados por família: `familia_produto`, `codigo_chave`/`sku`, `grupo`, **`tipo`**, `quantidade`, `receita_total`.

### 7.4 Regras de reconciliação (devoluções/cancelamentos/CFOP)  ⟵ validação exigida no pedido
Para os totais baterem, a API precisa garantir (e documentar) que:
- O `valor`/`receita_total` **já está líquido** de devoluções e cancelamentos, com a **mesma regra**
  usada no faturamento por pedido (`/clientes/{cod}/compras`, `situacao_pedido='F'`) e o **mesmo filtro de CFOP**.
- **Soma dos itens de um pedido = `valor` do pedido**; **soma por dia = faturamento do dia**;
  **soma por mês = faturamento do mês**. (O app fará essa conferência.)
- Esclarecer o papel de `/clientes/{cod}/cancelamentos` (pedidos cancelados por falta de produto):
  entram ou não no cálculo? Se saem, confirmar que já estão excluídos de `valor`.

### 7.5 Relação família ↔ código
`familia_produto` pode ter **mais de um `codigo_chave`**. **AÇÃO API:** confirmar a relação (1:N) e
como devemos exibir o "código menor" do grupo (ex.: menor `codigo_chave` da família) sem atribuir um
código incorreto ao grupo. Preferível a API retornar, por família, a lista de códigos ou um "código representativo".

### 7.6 Metas mensais — NÃO é responsabilidade da API
Decisão do usuário: **mostrar meta só no mês atual** e "Sem meta cadastrada" nos demais. As metas
ficam no nosso banco (uma meta atual por cliente); **a API não precisa fornecer histórico de metas**.

### 7.7 Performance/rede (porta 9443)  ⟵ impacto direto no Refresh e nas seções de produtos
Os endpoints pesados (`/clientes/{cod}/compras`, `/produtos/vendas-detalhadas`) dão **ConnectTimeout**
a partir do nosso ambiente; `/status` e `/health` respondem normalmente. **AÇÃO API/infra:** investigar
latência/limite/firewall na porta 9443 para esses endpoints. Ideal: um endpoint de **compras em lote**
(vários `cod_cliente` numa chamada) para a sincronização não precisar de ~210 chamadas individuais por vendedor.

## 8) PERGUNTAS ABERTAS PARA A EQUIPE DA API
1. Qual o nome final do campo de classificação (`tipo`?) e a **lista completa** de valores? Mapa surfaçado/acabado.
2. Vão criar o endpoint de **itens por pedido/dia** (7.1)? Nome e contrato finais.
3. `/produtos/vendas-detalhadas` cobre **12 meses**? Como filtrar por janela móvel (parâmetro)?
4. `valor`/`receita_total` já são líquidos de devolução/cancelamento e usam o mesmo CFOP do faturamento por pedido?
5. Relação família ↔ código (1:N) e qual "código representativo" retornar por família.
6. Possível endpoint de **compras em lote** para acelerar a sincronização (porta 9443)?


