# Novo tipo de campo: Endereço

Um único campo do formulário chamado **Endereço** que já vem com CEP, Rua, Número, Complemento, Bairro, Cidade e Estado.

## Como vai funcionar

1. Na criação/edição de campos do formulário, a lista de tipos ganha **Endereço** (junto de Texto curto, N Filhos, etc.). Não precisa configurar opções.
2. No formulário público, o campo mostra um bloco com:
   - CEP (com máscara 00000-000);
   - Rua, Número, Complemento (opcional), Bairro, Cidade, Estado.
3. Ao digitar os 8 dígitos do CEP, o sistema consulta automaticamente os Correios (ViaCEP) e preenche Rua, Bairro, Cidade e Estado, deixando o cursor no Número.
   - Enquanto busca, aparece "Buscando CEP...".
   - Se o CEP não for encontrado ou a consulta falhar, aparece um aviso discreto e todos os campos ficam livres para digitação manual.
   - Os campos preenchidos automaticamente continuam editáveis.
4. Sem CEP, tudo pode ser digitado normalmente.
5. Se o campo for marcado como obrigatório, a validação exige Rua, Número, Bairro, Cidade e Estado (CEP e Complemento não são exigidos).
6. Na visualização do cadastro, na impressão e nas informações do cartão do CRM, o endereço aparece em texto legível:
   `Rua X, 123 — Apto 2 — Bairro — Cidade/UF — CEP 00000-000`.

## Detalhes técnicos

- `src/lib/ext/model.ts`: novo `FieldType` `"address"` com rótulo "Endereço"; tipo `AddressEntry` (`cep, rua, numero, complemento, bairro, cidade, estado`), `emptyAddress()` e `parseAddress(raw)`. O valor é gravado como JSON string na resposta, mesmo padrão já usado por `children`.
- `src/components/FieldRenderer.tsx`: novo `AddressField` (subcomponente, como `ChildrenField`) com os inputs e a busca de CEP via `fetch("https://viacep.com.br/ws/<cep>/json/")` disparada quando o CEP tem 8 dígitos (com estado de carregando e tratamento de `erro: true`); `formatValue` ganha o caso `"address"` devolvendo a linha legível.
- `src/routes/f/$slug.tsx`: validação de obrigatoriedade para `address` (rua, numero, bairro, cidade, estado).
- `src/routes/_authenticated/formularios_.$formId.tsx`: o tipo entra automaticamente pela lista `FIELD_TYPE_LABELS`; garantir que "Endereço" não peça opções (ficar fora de `NEEDS_OPTIONS`).
- `src/lib/ext/destino.ts` (`answerText`) e `src/components/print/BlockView.tsx`: converter o JSON de endereço para a mesma linha legível, para cartão do CRM e impressão.
- Sem mudança de banco: aproveita a coluna de respostas existente.
