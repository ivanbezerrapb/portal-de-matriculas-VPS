# Evolução acumulada: modos Mês e Dia

No card **Evolução acumulada (até a mesma data)**, criar um segundo par de botões,
**Mês / Dia**, ao lado do par existente **Visitas / Crianças** (os dois grupos
funcionam juntos em qualquer modo).

## Como fica

- **Mês** (padrão): exatamente a visão de hoje — acumulado por mês, Ago a Jul.
- **Dia**: aparece um seletor de mês (Ago a Jul); o gráfico mostra os dias 1 a 31
  do mês escolhido e, em cada dia, o **acumulado desde o início do ano letivo até
  aquele dia**, comparando os três anos na mesma posição do calendário.
  - Anos anteriores: mês inteiro.
  - Ano corrente: só até hoje; se o mês selecionado for o atual, linha vertical
    "Hoje" no dia atual (como já ocorre no modo Mês).
- A legenda continua mostrando, para cada ano, o acumulado **até a mesma data de
  hoje** (no modo Dia, atualizada para o fim do dia de hoje).
- Detalhe ao passar o cursor mostra os três anos no dia apontado.

## Detalhes técnicos

### Dados — `src/lib/ext/cadastros.functions.ts` (`getDashboardStats`)

- Retornar também `daily: { month, day, visits, children }[]` (esparso, só entradas
  com valores), onde `month` é o índice do mês no ano letivo (0 = agosto) e `day` o
  dia do mês (1–31), derivados de `created_at`.
- Guardar por cadastro a data completa (mês + dia), não só o índice do mês, para
  somar crianças no dia correto (mesma lógica atual do `submissionMonth`).

### Dados — `src/lib/ext/legado.functions.ts` (`getLegacyYearStats`)

- Tipo `LegacyYearStats` ganha `daily: { month, day, visits, children }[]`.
- Extrair também o **dia** do "Carimbo de data/hora" (`dd/mm/aaaa`); linhas sem
  data válida continuam entrando nos totais, mas fora das séries.
- Nos dois casos o cliente reconstrói o acumulado: soma dos totais mensais
  anteriores ao mês escolhido + soma progressiva dos dias dentro do mês.

### Tela — `src/routes/_authenticated/dashboard.tsx` (`CumulativeChart`)

- Novo estado `granularity: "month" | "day"` (padrão `"month"`) e, no modo Dia,
  estado do mês selecionado (padrão: mês atual).
- Par de botões Mês/Dia no cabeçalho, no espaço apontado na referência.
- Modo Dia: eixo X com os dias do mês escolhido (1..n, conforme o mês real de cada
  ano — fevereiro etc.), cada série = acumulado do ano letivo até aquele dia;
  dias futuros do ano corrente ficam vazios (`null`).
- Rótulos do eixo X compactos (ex.: 1, 5, 10, 15, 20, 25, 31) para não poluir.
- Sem alteração de banco, permissões ou demais indicadores.

## Validação

- `bunx tsgo --noEmit` sem erros e build do portal OK.
- Conferir no preview que Mês permanece idêntico ao atual e que o modo Dia responde
  ao seletor de mês e ao botão Visitas/Crianças.
