# Corrigir erro ao salvar Endereço + guardar cada parte separada

## O que está acontecendo

Ao salvar o formulário com um campo do tipo **Endereço**, aparece a mensagem vermelha e nada é gravado, porque o banco ainda só aceita os tipos antigos de campo. Além disso, você pediu que CEP, Rua, Número, Bairro, Cidade e Estado fiquem **guardados separadamente** (hoje seriam gravados juntos em um único valor).

## O que será feito

### 1. Correção do erro ao salvar
- Liberar o tipo "Endereço" na lista de tipos aceitos pelo banco, sem alterar nenhum campo já cadastrado.

### 2. Endereço gravado em partes separadas
- Cada parte do endereço (CEP, Rua, Número, Complemento, Bairro, Cidade, Estado) passa a ser gravada como um registro próprio, vinculado ao campo Endereço do cadastro.
- Na tela de detalhes do cadastro, o endereço aparece item por item (CEP: ..., Rua: ..., Número: ...), um em cada linha, em vez de tudo junto.
- No CRM (aba Destino → Informações adicionais) e no modelo de impressão, cada parte pode ser escolhida individualmente: dá para colocar no cartão ou na folha só "Rua", só "Cidade/Estado", etc.
- Nada muda no preenchimento pelo responsável: digita o CEP, o restante se completa sozinho e continua editável.

### 3. Conferência
- Salvar um formulário com campo Endereço e enviar um cadastro de teste, confirmando que as partes aparecem separadas no cadastro, no CRM e na impressão.
- Se a mensagem de erro persistir só no navegador, basta recarregar a página para pegar a versão nova.

## Detalhes técnicos

- Migração: substituir `form_fields_type_check` para incluir `'address'`; adicionar coluna `part` (texto, nula) em `submission_values` e índice único em `(submission_id, field_id, coalesce(part,''))`, mantendo a linha principal com o endereço completo em JSON para compatibilidade.
- `publico.functions.ts`: ao gravar um campo `address`, inserir também as linhas por parte (`cep`, `rua`, `numero`, `complemento`, `bairro`, `cidade`, `estado`).
- `cadastros_.$submissionId.tsx` e `cadastros.functions.ts`: exibir cada parte em sua linha, com rótulos.
- `destino.ts`/`destino.server.ts`: aceitar ids sintéticos `<fieldId>.<parte>` nas informações adicionais e nas condições, resolvendo o valor da parte.
- Editor de impressão: oferecer as partes como campos selecionáveis.
- A validação Zod de tipos já contém `"address"`; nenhuma mudança nela.
