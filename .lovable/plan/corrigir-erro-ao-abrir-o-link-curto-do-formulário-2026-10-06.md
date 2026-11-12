# Corrigir erro ao abrir o link curto do formulário

## Causa
O endereço curto (ex.: `/novos-leads-expedicionarios`) chega ao servidor, mas a busca e o envio do formulário público ainda só aceitam o código longo antigo. Qualquer texto diferente é recusado antes da busca e aparece a mensagem "Invalid UUID".

## Correção
- Aceitar tanto o código longo antigo quanto o nome curto ao abrir o formulário.
- Fazer o mesmo no envio do cadastro, senão o formulário abriria mas falharia ao enviar.
- Limitar o texto aceito a letras minúsculas, números e hífens (até 120 caracteres). Endereços inválidos mostram "Formulário indisponível" em vez da tela de erro.

## Detalhes técnicos
- `src/lib/ext/publico.functions.ts`: em `getPublicForm` e `submitPublicForm`, trocar `z.string().uuid()` por `z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i)`. A busca continua por `public_slug` (coluna já é texto).
- Nenhuma mudança no banco nem nas telas.
