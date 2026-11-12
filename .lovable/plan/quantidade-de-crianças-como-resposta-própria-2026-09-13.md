# Quantidade de crianças como resposta própria

Hoje o número de crianças fica apenas numa coluna da tabela de cadastros. Vamos passar a gravá-lo também como uma resposta própria, ao lado das demais respostas do cadastro, mantendo a coluna atual preenchida em paralelo.

## Como vai funcionar

- Todo formulário que tiver um campo "N Filhos" ganha automaticamente um campo interno chamado **Quantidade de crianças** (tipo número, oculto no formulário público e na edição).
- A cada cadastro novo ou editado, esse campo recebe o total de crianças informadas.
- Na tabela de respostas, além do texto, o número também fica guardado em uma coluna numérica, pronta para somas e relatórios.
- Cadastros já existentes recebem o valor correspondente.
- A coluna atual na tabela de cadastros continua sendo preenchida; nada na listagem muda.

## Detalhes técnicos

1. Migração no Supabase externo (`supabase-setup.sql` + aplicação no banco):
   - `alter table public.submission_values add column value_number numeric;`
   - Criação, por formulário que possua campo `children`, de um `form_fields` com `type = 'number'`, `label = 'Quantidade de crianças'`, `internal = true`, `required = false`, `position` no fim.
   - Backfill: para cada submission existente, inserir em `submission_values` a linha `(submission_id, campo interno, value = texto do número, value_number = número)` a partir de `submissions.children_count`.
2. `src/lib/ext/publico.functions.ts`: ao inserir o cadastro, além de `children_count`, gravar a linha do campo interno com `value` e `value_number`.
3. `src/lib/ext/cadastros.functions.ts`: no recálculo já existente, fazer upsert dessa mesma linha (`value`/`value_number`) junto com a atualização de `children_count`.
4. Helper compartilhado (em `src/lib/ext/model.ts`) para localizar/garantir o campo interno de contagem de um formulário, evitando duplicação entre as duas funções.
5. Ocultar campos `internal` no formulário público (`src/routes/f/$slug.tsx`) e na edição de cadastros, caso ainda não estejam filtrados.
6. Editor de formulário: o campo interno não aparece na lista de campos editáveis.
7. `supabase--get_types` após a migração.

## Fora de escopo

- Remover ou parar de usar a coluna `children_count` da tabela de cadastros.
