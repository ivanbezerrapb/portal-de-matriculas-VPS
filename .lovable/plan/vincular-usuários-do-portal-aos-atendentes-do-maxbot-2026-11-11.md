# Vincular usuários do Portal aos atendentes do Maxbot

## O que muda para você
Em **Configurações › Usuários**, na janela **Editar** de cada usuário, aparece uma nova seção **Atendente no Maxbot** com dois seletores:
- **Maxbot Conecta** – lista os atendentes reais dessa conta (nome e ID).
- **Maxbot Interactivo** – idem (só aparece com token salvo).

Cada seletor tem a opção "Não vinculado". Ao salvar, o vínculo fica gravado. Na lista de usuários, quem já está vinculado mostra um pequeno selo "Maxbot" com o nome do atendente.

- Só Administradores veem e alteram esse vínculo.
- Um atendente do Maxbot só pode estar ligado a um usuário por conta; se já estiver em uso, o seletor avisa quem é.
- Atendentes inativos no Maxbot aparecem marcados como "(inativo)".
- Toda alteração entra no **Log de Registro**.

Esse vínculo será usado no próximo passo, para enviar mensagens em nome do atendente.

## Detalhes técnicos
- Armazenamento: o mesmo arquivo privado `integracoes/maxbot.json`, novo campo por conta `attendants: { [portalUserId]: { id, name } }` (sem migração no banco externo; tokens continuam só no servidor).
- `maxbot.server.ts`: tipos + `listAttendants(account)` via comando `get_attendant`.
- `maxbot.functions.ts` (admin): `listMaxbotAttendants({account})`, `getMaxbotUserLinks()`, `saveMaxbotUserLink({userId, conecta?, interactivo?})` com checagem de duplicidade e log em `activity_logs` (área `maxbot_settings`).
- `usuarios.tsx`: carrega vínculos e atendentes; seção na janela Editar; selo na listagem.
