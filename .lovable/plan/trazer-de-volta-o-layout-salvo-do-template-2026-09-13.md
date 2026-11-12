# Trazer de volta o layout salvo do template

## O que aconteceu

Nada foi perdido. Conferi no banco: os dois templates ("Impressão Interactivo" e "Impressão Conecta") continuam com o layout completo salvo, cada um com 2 páginas e a lista de campos.

O problema é só na tela: ao clicar em "Editar", o campo "Formulário de referência" volta sempre vazio, porque essa escolha nunca foi guardada junto com o template. E a área do layout só aparece depois que um formulário de referência está selecionado — por isso você vê a mensagem "Escolha um formulário de referência para montar o layout" no lugar da folha com logo, tabela e campos.

Risco atual: escolher o formulário na lista dispara uma religação de campos, o que pode embaralhar o layout que já estava certo.

## O que vai mudar

1. O template passa a guardar qual formulário foi usado como referência. Ao clicar em "Editar", ele já vem selecionado e a folha aparece pronta para editar, como antes.
2. Para os dois templates existentes, o formulário de referência é identificado automaticamente pelos campos já gravados no template e preenchido de uma vez, sem precisar refazer nada.
3. Ao reabrir um template, o layout é mostrado exatamente como foi salvo — a religação de campos só acontece quando você trocar o formulário de referência de propósito.
4. Se por algum motivo não der para identificar o formulário, a folha ainda é exibida com os campos gravados no próprio template, com um aviso para escolher o formulário de referência quando quiser editar os campos.

## Detalhes técnicos

- Migração: `alter table public.print_template_library add column ref_form_id uuid references public.forms(id) on delete set null;` e backfill comparando os `id` em `field_labels` com `form_fields.form_id` (escolhe o formulário com maior interseção).
- `src/lib/ext/templates.functions.ts`: `listTemplates` retorna `ref_form_id`; `saveTemplate` aceita e grava `ref_form_id`.
- `src/routes/_authenticated/templates.tsx`: o handler de "Editar" (linha ~220) passa a usar `ref_form_id: t.ref_form_id ?? ""`; o `onChange` do select só roda `mapFieldsByLabel`/`remapLayoutFields` quando o valor realmente muda em relação ao já salvo; o bloco "Layout da folha" (linha ~428) renderiza o `LayoutEditor` usando `refFields` quando houver referência, ou os campos de `prev_field_labels` como fallback somente-leitura de rótulos.
- Nenhuma alteração em `print_templates` (cópias por formulário) nem em `LayoutEditor`.
