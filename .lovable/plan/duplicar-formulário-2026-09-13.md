# Duplicar formulário

Adicionar um botão **Duplicar** em cada formulário da lista. Ao clicar, abre uma pequena janela que pede:

- **Novo título** (pré-preenchido com "Cópia de <título>")
- **Escola** (pré-selecionada com a escola atual, podendo trocar)

Ao confirmar, o sistema cria um novo formulário com esses dados e copia:

- todos os campos, na mesma ordem e com as mesmas configurações (obrigatório, interno, opções, listas de Série/Turno do tipo N Filhos)
- todos os modelos de impressão, já apontando para os campos copiados

O novo formulário nasce como **Rascunho**, com link público próprio, e **sem** nenhum cadastro preenchido. Depois de criado, a lista é atualizada e aparece uma confirmação.

## Detalhes técnicos

- Nova server function `duplicateForm({ id, title, school_id })` em `src/lib/ext/formularios.functions.ts`:
  - lê o formulário de origem + `form_fields` + `print_templates`
  - insere o novo `forms` (status `draft`, `created_by` = usuário atual, slug novo gerado como já ocorre em `createForm`)
  - insere os campos preservando `position` e monta um mapa `id antigo -> id novo`
  - insere os modelos de impressão remapeando `field_ids` pelo mapa
- `src/routes/_authenticated/formularios.tsx`: botão "Duplicar" no card, com estado de diálogo (título + select de escola reaproveitando a query `schools`), mutação e invalidação de `["admin-forms"]`.
