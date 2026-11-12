# Card do ano letivo 2026 com os dados importados

Hoje o card "2026 (2025)" da tela Início aparece com traços, porque o sistema só
calcula os dados dos cadastros feitos no portal (ano 2027). Os dados de 2026 já
estão no portal, importados em **Bancos anteriores** (BD_VISITAS_2026, 1.261
registros), e podem alimentar esse card.

## O que muda

- O card **2026 (2025)** passa a mostrar **Total de visitas** e **Total de
  crianças** vindos do banco importado daquele ano letivo.
- O card respeita o **filtro de escolas** do topo: escolhendo Bessa, por
  exemplo, o card 2026 mostra só os números de Bessa; sem filtro, mostra o
  total das quatro unidades.
- Os cards de anos anteriores (2025, 2024...) seguem a mesma regra automática:
  sempre que houver um banco importado com aquele ano letivo, o card é
  preenchido; sem banco, continua com traço.
- Nada mais muda: os gráficos abaixo continuam refletindo o ano letivo corrente
  (2027), e os cadastros atuais não são alterados.

## Como os números são contados

Por linha da planilha importada:

- **Visita** = 1 por registro.
- **Crianças** = valor da coluna "Quantos alunos pretende trazer para estudar
  conosco?" (quando vazio ou inválido, conta 1).
- **Unidade** = coluna "ESCOLA" (Bessa, Cristo, Centro, Expedicionários), que
  bate exatamente com os nomes das unidades cadastradas.

Conferência na base: Bessa 434, Cristo 353, Centro 283, Expedicionários 191 —
1.261 visitas no total.

## Detalhes técnicos

- `src/lib/ext/legado.functions.ts`: nova função `getLegacyYearStats`
  (autenticada, sem exigir admin — leitura apenas de agregados) que recebe
  `{ years: number[], schoolNames?: string[] }` e devolve, por ano letivo,
  `{ year, visits, children, bySchool: [{ name, visits, children }] }`.
  Agregação feita no servidor lendo `legacy_rows` do(s) `legacy_datasets`
  correspondentes ao ano, em páginas de 1.000 linhas.
- Policies: as tabelas `legacy_datasets`/`legacy_rows` hoje têm SELECT só para
  admin. Será adicionada policy de SELECT para `authenticated` (leitura),
  mantendo INSERT/DELETE restritos ao Administrador — necessário para que
  Direção, Gerente e Secretaria também vejam o card. Alternativa, se preferir
  manter fechado: só Administrador e Direção enxergam os números de 2026.
- `src/routes/_authenticated/dashboard.tsx`: nova query `legacy-year-stats`
  para `[currentYear - 1, currentYear - 2]`, convertendo os ids de escolas
  selecionadas em nomes; os dois `YearCard` passam a receber os valores
  retornados (ou `null` quando não houver banco daquele ano).
