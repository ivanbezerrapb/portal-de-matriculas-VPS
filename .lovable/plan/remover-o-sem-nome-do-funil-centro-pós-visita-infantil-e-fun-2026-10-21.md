# Remover o "Sem nome" do funil Centro - Pós Visita (Infantil e Fund I)

O mesmo problema aparece em outros funis (ex.: Centro - Pós Visita (Fund II e Médio), onde aparece "Sem nome" junto de Fabiana Grisi e ALICE FABIANA). A correção abaixo vale para todos.

## Causa (confirmada no banco)
O funil tem dois responsáveis vinculados:
- ANA CLAUDIA (usuária ativa, Central de Informações)
- Um usuário que já foi excluído: não tem mais nome nem perfil, mas o vínculo com o funil ficou para trás.

Por isso a janela "Quem atendeu?" mostra "Sem nome" e não envia direto para a Ana Claudia.

## O que será feito
1. Apagar esse vínculo órfão. Depois disso a Ana Claudia vira a única responsável, e o envio para esse funil passa a preencher o Atendimento sozinho, sem abrir a janela.
2. Procurar e apagar vínculos órfãos iguais em todos os outros funis.
3. Ao excluir um usuário em Configurações › Usuários, apagar também os vínculos dele com funis, para isso não voltar a acontecer.
4. Por segurança, a lista de responsáveis passa a ignorar usuários sem cadastro.

## Detalhes técnicos
- DELETE em `user_funnels` onde `user_id` não existe em `profiles`.
- `deleteUser` (usuarios.functions.ts): remover `user_funnels` do usuário.
- `listFunnelOwners` / `sendSubmissionToFunnel`: considerar só vínculos com perfil existente.
