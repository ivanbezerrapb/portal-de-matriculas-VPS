# Novo tipo de campo: N Filhos

Criar um tipo de campo que pergunta quantas crianças o responsável pretende trazer (de 1 a 5) e, conforme o número escolhido, mostra um bloco de dados para cada criança: Nome, Data de nascimento, Série e Turno.

## Como vai funcionar

**Ao montar o formulário**
- Novo tipo "N Filhos" na lista de tipos do campo.
- Ao escolher esse tipo, aparecem duas listas para você preencher: as opções de Série e as opções de Turno (uma por linha), do mesmo jeito que já é feito nos campos de seleção.
- Limite fixo de 5 crianças.

**No formulário público**
- O responsável escolhe o número de crianças (1 a 5).
- Aparecem os blocos "Criança 1", "Criança 2"… com Nome (texto), Data de nascimento (data), Série (lista) e Turno (lista).
- Ao reduzir o número, os blocos excedentes somem; ao aumentar, novos blocos aparecem em branco.
- Se o campo estiver marcado como obrigatório, os quatro dados de cada criança são exigidos — validado na tela e também no servidor no momento do envio.

**Na listagem e no cadastro**
- Na tela do cadastro, os dados aparecem como uma pequena tabela: uma linha por criança com nome, nascimento, série e turno.
- O editor autorizado pode alterar esses dados e mudar o número de crianças, com o mesmo registro de histórico de alterações já existente.
- Na impressão, o campo sai como uma lista numerada ("1. Nome — 00/00/0000 — Série — Turno").

## Detalhes técnicos

- Banco: ampliar o `check` de `form_fields.type` para incluir `children` (migração aditiva no Supabase externo, mais atualização de `supabase-setup.sql`). As opções de Série e Turno são guardadas na coluna `options` já existente, no formato `serie:<valor>` e `turno:<valor>`, evitando nova coluna.
- Valor gravado em `submission_values.value`: JSON `[{"nome":"","nascimento":"","serie":"","turno":""}]`, tratado como string como os demais tipos.
- `src/lib/ext/model.ts`: adicionar `children` a `FieldType` e `FIELD_TYPE_LABELS` ("N Filhos"), mais helpers de parse/serialização das opções e do valor.
- `src/components/FieldRenderer.tsx`: novo bloco de renderização (seletor de quantidade + blocos repetidos) e tratamento em `formatValue` para exibição/impressão.
- `src/routes/_authenticated/formularios_.$formId.tsx`: editor de opções de Série e Turno para o novo tipo.
- `src/routes/f/$slug.tsx`: validação no cliente dos blocos obrigatórios.
- `src/lib/ext/publico.functions.ts` e `cadastros.functions.ts`: incluir `children` nos enums zod e validar no servidor (quantidade entre 1 e 5 e os quatro dados preenchidos quando obrigatório).
- `src/lib/ext/formularios.functions.ts`: incluir `children` no enum de tipos do campo.
- `src/routes/_authenticated/imprimir.$templateId.tsx`: usar a formatação em lista.
