# Troca obrigatória de senha no próximo acesso

## O que muda
- **Novo usuário:** abaixo de "Senha inicial", uma caixa de marcar **"Exigir troca de senha no próximo acesso"** (vem marcada).
- **Usuários existentes:** em cada cartão da lista, um botão **"Exigir troca de senha"** / **"Cancelar exigência"**, e um selo laranja "Troca de senha pendente" quando ativo. Também um botão **"Redefinir senha"** para o administrador definir uma nova senha provisória (com a mesma opção de exigir troca).
- **No login:** se o usuário estiver marcado, depois de entrar ele vê uma tela **"Defina sua nova senha"** (nova senha + confirmação, mínimo 6 caracteres, com o olho para mostrar). Não consegue usar o portal até trocar. A nova senha não pode ser igual à atual.
- Ao salvar, a marcação é removida automaticamente e o usuário segue para o Início.
- Fica registrado no Log de Registro.

## Detalhes técnicos
- Banco externo: coluna `profiles.must_change_password boolean not null default false` (atualizar `supabase-setup.sql`). Usuário não pode alterar essa coluna sozinho para `false` sem trocar a senha: a limpeza é feita por server function com admin client após `updateUser`.
- `usuarios.functions.ts`: `createUser` aceita `must_change_password`; novo `setMustChangePassword({user_id, value})` e `resetUserPassword({user_id, password, must_change_password})` (admin only); `listUsers` retorna o campo.
- Nova `getMyPasswordStatus` e `completePasswordChange({password})` (requireAuth): atualiza a senha via admin `updateUserById` e zera a flag.
- `_authenticated/route.tsx`: consulta o status; se pendente, renderiza a tela de troca no lugar do conteúdo/menu.
- `usuarios.tsx`: checkbox, selo e botões.
