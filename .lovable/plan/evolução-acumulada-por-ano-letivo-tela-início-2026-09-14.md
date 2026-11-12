# Evolução acumulada por ano letivo (tela Início)

Novo indicador comparando os anos letivos 2027, 2026 e 2025, ocupando 2 das 3 colunas
da grade.

## Como fica

- Card **Evolução acumulada** com três linhas, uma por ano letivo:
  - 2027 (01/08/2026 a 31/07/2027) — dados atuais do portal;
  - 2026 (01/08/2025 a 31/07/2026) — banco importado BD_VISITAS_2026;
  - 2025 (01/08/2024 a 31/07/2025) — banco importado BD_VISITAS_2025.
- Eixo horizontal de Ago a Jul; valores acumulados mês a mês.
- Anos anteriores exibem o ano letivo inteiro; o ano corrente vai só até hoje.
- Linha tracejada vertical marcando **Hoje (14/09)**, como na referência enviada.
- Botão no canto do card para alternar entre **Visitas** e **Crianças**.
- Legenda com as três cores e, ao lado de cada ano, o acumulado **até a mesma data
  de hoje** — é isso que permite a comparação justa.
- Detalhe ao passar o cursor mostrando os três anos no mês apontado.
- O card respeita o filtro de escolas do topo, igual aos demais indicadores.

## Posição na tela

Abaixo dos três cards anuais: uma linha com o novo gráfico ocupando 2 colunas e o
comparativo por escola ocupando a coluna restante. No celular, empilhados.

## Observação sobre os dados

Nos bancos importados a data usada é a coluna "Carimbo de data/hora". Conferido: o
banco de 2025 tem registros de 08/10/2024 a 31/07/2025 e o de 2026 de 03/09/2025 a
14/05/2026. Como não há registros antes de setembro em nenhum dos dois, os primeiros
meses das curvas antigas aparecem zerados — é o que a planilha contém.

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts`: `getDashboardStats` passa a retornar
  `monthly: { month: 0..11, visits, children }[]` (mês 0 = agosto), acumulando os
  cadastros do ano letivo corrente já filtrados por escola.
- `src/lib/ext/legado.functions.ts`: `getLegacyYearStats` ganha, por ano,
  `monthly: { month, visits, children }[]`, derivado do parse de
  "Carimbo de data/hora" (`dd/mm/aaaa`) mapeado para o índice do mês do ano letivo;
  linhas sem data válida entram no total mas não na série mensal.
- `src/routes/_authenticated/dashboard.tsx`: novo componente `CumulativeChart`
  (Recharts `LineChart` + `ReferenceLine` para "Hoje"), com estado local
  visits/children; grid `lg:grid-cols-3` com o gráfico em `lg:col-span-2` e
  `SchoolComparisonChart` na terceira coluna.
- Cores semânticas do tema já usadas nos outros gráficos; sem alteração de banco.
