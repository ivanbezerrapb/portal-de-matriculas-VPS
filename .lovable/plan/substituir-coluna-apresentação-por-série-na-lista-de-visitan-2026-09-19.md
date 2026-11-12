# Substituir coluna Apresentação por Série na Lista de Visitantes

## O que muda na tela

- A coluna **Apresentação** sai da Lista de Visitantes.
- No lugar entra a coluna **Série**, logo após "Data", mostrando a série de interesse de cada aluno informado no cadastro:
  - 1 aluno → uma série (ex.: "9º EF").
  - Mais de um aluno → uma série por linha, uma abaixo da outra, na mesma ordem das crianças do cadastro.
  - Criança sem série informada → "—".
- Nada mais muda: o cadastro da apresentação continua existindo por enquanto apenas fora da listagem (coluna sai só daqui; os dados já gravados não são apagados). O restante da tela (filtros, Funil, Atendimento, matrícula) continua igual.

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts` (`listSubmissions`):
  - As respostas dos cadastros já são lidas de `submission_values`; incluir também as linhas `part = "child"` (ou o campo de crianças), parseando com `parseChildren` de `src/lib/ext/model.ts`.
  - Cada linha passa a retornar `series: string[]` (série de cada criança, já na ordem), sem alterar o que já é retornado.
- `src/routes/_authenticated/cadastros.tsx`:
  - Trocar o `<th>` "Apresentação" por "Série".
  - Substituir a célula `PersonCell kind="coordenacao"` por uma célula simples que renderiza `series` com uma linha por item (mesmo padrão visual das crianças em outras telas).
- Sem alteração no banco de dados, permissões ou cálculos de indicadores.
