# Templates de impressão compartilhados

Hoje cada modelo de impressão nasce dentro de um formulário e só serve para ele. A ideia é ter uma biblioteca de templates reutilizáveis.

## Novo menu "Templates"

- Item novo na barra lateral, ao lado de Formulários.
- Lista todos os templates compartilhados (nome, tamanho da folha, escolas marcadas).
- Ações por template: **Editar** (mesmo editor visual de layout atual), **Duplicar** (pede um novo nome e cria uma cópia independente) e **Excluir**.
- Ao criar/editar um template, é possível marcar **quais escolas** ele atende. Marcar escolas gera automaticamente uma cópia do template nos formulários dessas escolas (escolhendo o formulário de destino de cada escola).
- Um template também pode ser criado a partir de um modelo já existente dentro de um formulário ("Salvar como template").

## Dentro do formulário (aba Modelos de impressão)

- Botão novo: **Usar um template**, que abre a lista de templates e copia o escolhido para aquele formulário.
- Botão **Duplicar** em cada modelo já existente do formulário.

## Como os campos são ligados

Ao copiar um template para outro formulário, o sistema liga os campos **pelo nome** (rótulo). Campos com nome igual ficam prontos; os que não existirem no formulário de destino aparecem destacados no editor para eu ajustar ou remover. Textos fixos, imagens, tabelas e posições vêm iguais.

## Detalhes técnicos

- Nova tabela `print_template_library` (id, name, title, header/footer, show_logo, columns, page_size, show_signature, layout jsonb, school_ids uuid[], created_by, timestamps) com grants e RLS: leitura para autenticados, escrita para admin (e gestor da própria escola quando `school_ids` incluir a escola dele). Aplicada no Supabase externo via `EXT_SUPABASE_DB_URL` (mesma rota do `supabase-setup.sql`, que também será atualizado).
- `src/lib/ext/templates.functions.ts`: `listTemplates`, `getTemplate`, `saveTemplate`, `duplicateTemplate`, `deleteTemplate`, `applyTemplateToForm({ template_id, form_id })` e `saveFormTemplateAsLibrary({ print_template_id, name })`.
- Remapeamento de campos: função utilitária em `src/lib/ext/print-layout.ts` que percorre os blocos do layout, troca `field_id` por match de `label` normalizado (trim + minúsculas + sem acentos) nos `form_fields` do destino e marca como não resolvido o que sobrar; `field_ids` do modelo criado seguem a mesma regra.
- Nova rota `src/routes/_authenticated/templates.tsx` (lista + diálogos) e `templates_.$templateId.tsx` reaproveitando `LayoutEditor`; link adicionado ao menu em `__root.tsx`/layout autenticado.
- `TemplatesTab` em `formularios_.$formId.tsx` ganha "Usar um template", "Duplicar" e "Salvar como template", invalidando `["form", formId]`.
