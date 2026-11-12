# Template atualiza todos os formulários associados

Hoje, ao associar um template a um formulário, é feita uma cópia independente. Se o template é editado depois, os formulários continuam com a versão antiga. A associação também é reconhecida apenas pelo nome do modelo, o que quebra se o nome mudar.

## O que muda

- Cada modelo dentro de um formulário passa a guardar de qual template da biblioteca ele veio.
- Ao salvar um template no menu Templates, todos os formulários que já usam esse template são atualizados automaticamente: título, cabeçalho, rodapé, papel, colunas, assinatura e o layout montado.
- Os campos continuam sendo religados pelo nome em cada formulário, então cada escola mantém seus próprios dados no lugar certo.
- Renomear o template passa a funcionar: a ligação é pelo template, não pelo nome.
- Ao terminar de salvar, a mensagem informa quantos formulários foram atualizados.
- Excluir um template da biblioteca não apaga os modelos já usados nos formulários; eles apenas deixam de receber atualizações.

## Detalhes técnicos

Banco (migração no Supabase externo, `supabase-setup.sql` atualizado):

- `public.print_templates`: nova coluna `library_id uuid references public.print_template_library(id) on delete set null`, com índice.
- Backfill dos registros existentes casando `print_templates.name` com `print_template_library.name`.

`src/lib/ext/templates.functions.ts`:

- `applyToForm` grava `library_id` no payload e busca o modelo existente por `form_id + library_id` (fallback por nome, para os casos antigos sem vínculo).
- Nova função `propagateToLinkedForms(supabase, lib)`: lê `print_templates` por `library_id`, e reaplica `applyToForm` em cada `form_id` distinto.
- `saveTemplate`: depois de gravar a biblioteca, roda `propagateToLinkedForms` e mantém `applyToSchools` para as escolas marcadas (formulários dessas escolas que ainda não têm o modelo passam a ter). Retorna `{ template, applied }` com a contagem total de formulários atingidos.
- `applyTemplateToForm` continua igual, já passando pelo `applyToForm` com vínculo.
- `saveFormTemplateAsLibrary`: após criar o item na biblioteca, vincula o modelo de origem (`library_id`) ao novo template.

`src/routes/_authenticated/templates.tsx`: o aviso de sucesso passa a mostrar quantos formulários foram atualizados.
