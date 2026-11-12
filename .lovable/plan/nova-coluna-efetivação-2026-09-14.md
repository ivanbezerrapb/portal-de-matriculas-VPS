# Nova coluna Efetivação

## O que muda

Além de **Atendimento** e **Apresentação**, cada cadastro passa a ter **Efetivação**: o nome de quem efetivou a matrícula daquela ficha.

## Regras (iguais às já existentes)

- Nova coluna **Efetivação** na Lista de cadastros, ao lado de Apresentação.
- Lista suspensa com autocompletar mostrando só os nomes ativos **daquela unidade** desse tipo; se o nome não existir, oferece **"Cadastrar «nome»"**.
- Ao escolher, o vínculo é salvo na hora, com registro no histórico.
- Quem pode alterar: Administrador e Gerente da unidade do cadastro; os demais veem somente leitura.
- Sem nome informado, mostra "—".
- A janela que aparece ao marcar **Matrícula** passa a pedir também **Quem efetivou**, junto de Quem atendeu e Quem apresentou; Confirmar só habilita com os três nomes e a quantidade válida.
- Na tela **Início**, novo indicador **"Quem mais efetivou"**, no mesmo formato dos outros dois e respeitando o filtro de unidades e o ano de campanha.

## Detalhes técnicos

Banco (migração via psql):

- `presenters`: ampliar o check de `kind` para aceitar `'efetivacao'` (mantendo `secretaria` e `coordenacao`); índice único por unidade/tipo/nome continua valendo.
- `submissions`: nova coluna `enroller_id uuid references public.presenters(id) on delete set null` (nula). Sem alteração de RLS/grants (herdadas da tabela).

Código:

- `apresentacao.functions.ts`: `PRESENTER_KINDS` ganha `"efetivacao"` e rótulo "Efetivação (quem efetivou)".
- `cadastros.functions.ts`:
  - `listSubmissions` e `getDashboardStats` passam a selecionar `enroller:presenters!submissions_enroller_id_fkey(id, name)`.
  - `setSubmissionPeople`: validador aceita `kind: "efetivacao"` e mapeia para a coluna `enroller_id`.
  - `getDashboardStats` retorna `enrollers: [{ name, count }]` contado como `attendants`/`presenters`.
- `cadastros.tsx`: cabeçalho e célula `PersonCell` para Efetivação (placeholder "Quem efetivou"); na janela de matrícula, terceiro campo `dialogEnroller` com a mesma seleção, gravado antes de `setEnrollment`; validação do Confirmar inclui o novo campo.
- `dashboard.tsx`: mais um `SeriesChart` com `data.enrollers`, título "Quem mais efetivou".
- `supabase--get_types` após a migração.
