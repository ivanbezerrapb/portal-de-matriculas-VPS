# Novos filtros nas listas e correção das barras no Início

## 1. Filtros na Lista de Visitantes e na Lista de LEADS
Nova linha de filtros abaixo dos atuais (Buscar por ID, Escola, Formulário, De/Até):
- **Funil:** Todos / Sem funil / um funil específico (só os funis daquela lista).
- **Pendência pedagógica:** Todos / Com pendência (triângulo laranja) / Sem pendência.
- **Atendimento:** Todos / Sem atendimento / um nome específico.
- **Série:** Todas / Sem série / uma série específica.
- **Matrícula** (Visitantes) ou **Check-in** (LEADS): Todos / Sim / Não.
- **Busca por nome do responsável** (no mesmo campo "Buscar por ID", passa a aceitar ID ou nome).
- Botão **Limpar filtros** e contador "X cadastros encontrados".

Os filtros combinam entre si e com a ordenação por coluna já existente. Nada muda nos dados.

## 2. Barras de "Visitantes por bairro" e "Quem mais atendeu"
- Hoje só a primeira barra de cada unidade aparece; as demais mostram apenas o número. Todas passam a ter barra proporcional, com o valor ao lado.
- Nomes que estavam cortados à esquerda (ex.: "ardim Oceania") ganham espaço suficiente.

## Técnico
- `SubmissionsList.tsx`: filtros aplicados no cliente sobre as linhas já carregadas (`funnel_id`/oportunidade, `restricted`, `attendant`, séries, `enrolled`/check-in, nome do responsável), antes de `sortRows`.
- `dashboard.tsx` (`NeighborhoodChart`): adicionar `<XAxis type="number" hide domain={[0, "dataMax"]} />` (a falta do eixo numérico faz o gráfico tratar a escala como categoria) e aumentar a largura mínima do eixo de rótulos.
