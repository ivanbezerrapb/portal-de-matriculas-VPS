# Corrigir erro ao escolher o funil na Lista de Visitantes

## Causa
O erro "new row violates row-level security policy for table opportunities" aparece quando um usuário **Secretaria** escolhe o funil. A regra do banco que permite criar/mover cartões do CRM só aceita Administrador, Gerente e Central de Informações — a Secretaria ficou de fora, embora a tela permita a ela enviar o lead ao funil. (Testei o mesmo envio como Administrador e funcionou.)

## Correção
- Ao enviar ao funil, o portal continua conferindo tudo antes: perfil (Administrador, Gerente ou Secretaria da unidade do lead), funil da mesma unidade e da lista certa (Visitantes x LEADS), responsável vinculado.
- Depois dessas conferências, a criação ou movimentação do cartão (e a tarefa 1º CONTATO) passa a ser gravada pelo próprio servidor, sem depender da permissão do perfil no CRM.
- A Secretaria **não** ganha acesso ao Pipeline nem a editar cartões por lá; só passa a conseguir enviar o lead ao funil, como já era a intenção.

## Detalhes técnicos
- `src/lib/ext/cadastros.functions.ts` (`sendSubmissionToFunnel`): trocar `context.supabase` por `extAdmin()` nas consultas/escritas em `opportunities` (busca da posição, cartão existente, update e insert) e no update de `submissions.crm_status`, mantendo as validações de permissão já feitas antes.
- O gatilho `crm_first_contact_task` continua criando a tarefa em D+1 útil.
- Sem mudança de policies no banco.
- Verificação: simular o envio como um usuário Secretaria e confirmar cartão + tarefa criados.
