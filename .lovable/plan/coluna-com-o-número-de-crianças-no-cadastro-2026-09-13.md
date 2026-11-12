# Coluna com o número de crianças no cadastro

Hoje a quantidade de crianças fica embutida no JSON do campo "N Filhos". Vamos gravar esse número também em uma coluna própria da tabela de cadastros, para você poder consultar e usar essa informação no futuro (relatórios, integrações etc.).

## Como vai funcionar

- A tabela de cadastros ganha a coluna **children_count** (número inteiro, pode ficar vazia quando o formulário não tem campo "N Filhos").
- Ao enviar o formulário público, o sistema conta quantas crianças foram informadas e grava esse número na coluna.
- Ao editar um cadastro pelo sistema (editor autorizado), se o número de crianças mudar, a coluna é atualizada junto.
- Cadastros já existentes serão atualizados automaticamente (o sistema lê o JSON gravado e preenche a coluna).
- A coluna passa a aparecer também na listagem de cadastros, para facilitar a visualização.

## Detalhes técnicos

- Banco (Supabase externo, via SQL direto, mesmo processo das alterações anteriores):
  - `alter table public.submissions add column children_count integer;`
  - Backfill dos cadastros existentes: percorrer `submission_values` de campos `children` e atualizar `submissions.children_count` com o número de itens do JSON (feito via script no servidor, pois exige parse de JSON).
  - Atualizar `supabase-setup.sql` com a nova coluna.
- `src/lib/ext/publico.functions.ts` (`submitPublicForm`): ao validar os campos, se houver campo do tipo `children`, calcular `parseChildren(value).length` e incluir `children_count` no insert de `submissions`.
- `src/lib/ext/cadastros.functions.ts` (`updateSubmission`): após os upserts, buscar os campos `children` do formulário, recalcular a quantidade a partir dos valores salvos e atualizar `submissions.children_count` (registrando no histórico quando mudar).
- `src/routes/_authenticated/cadastros.tsx`: exibir coluna "Crianças" na listagem (mostra o número ou "—" quando vazio).
