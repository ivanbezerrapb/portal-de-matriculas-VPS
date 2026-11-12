# Coluna "Funil" no lugar de "Efetivação"

## O que muda na Lista de Visitantes

- A coluna **Efetivação** sai da listagem (e também do diálogo de matrícula e do indicador "Quem mais efetivou" na tela Início).
- No lugar entra a coluna **Funil**, com uma lista dos funis da unidade daquele lead.
- Ao escolher o funil:
  - o lead vira um cartão na **1ª etapa** desse funil, com a tarefa **1º CONTATO** já criada para o **próximo dia útil** (regra atual do CRM);
  - se o lead já tiver cartão, ele é **movido** para a 1ª etapa do funil escolhido, em vez de criar outro;
  - aparece uma janela pedindo **quem atendeu**, listando os responsáveis vinculados àquele funil; o nome escolhido vai automaticamente para a coluna **Atendimento**. Quando houver só um responsável, ele é usado direto, sem perguntar.
- A coluna mostra o funil atual do lead; quem ainda não foi enviado aparece com "—".
- Podem usar: **Secretaria, Gerente e Administrador**, sempre apenas nos leads da unidade a que pertencem.

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts`: `listSubmissions` passa a trazer o funil atual do cadastro (oportunidade aberta: `funnel_id`, nome do funil). Nova função `sendSubmissionToFunnel({ submission_id, funnel_id, attendant_user_id? })` que:
  - valida permissão (admin, gerente ou secretaria da escola do cadastro) e que o funil pertence à mesma escola;
  - busca a 1ª etapa (`funnel_stages` menor `position`);
  - se existir oportunidade aberta do cadastro, faz update de `funnel_id`/`stage_id`/`position`; senão insere nova oportunidade (nome/telefone/e-mail do cadastro), deixando o gatilho `crm_first_contact_task` criar a tarefa 1º CONTATO em D+1 útil;
  - resolve o Atendimento: a partir do nome do responsável escolhido, localiza ou cria um registro em `presenters` (kind `secretaria`, mesma escola) e grava `submissions.attendant_id`.
- `src/lib/ext/funis.functions.ts`: `listFunnelOwners` já devolve `{funnel_id, user_id, name}` — usado para montar a lista de responsáveis do funil.
- `src/routes/_authenticated/cadastros.tsx`: remove a célula/cabeçalho `PersonCell kind="efetivacao"` e o campo de Efetivação no diálogo de matrícula; adiciona coluna **Funil** (select filtrado por `school_id` via `listFunnels`), diálogo "Quem atendeu?" quando o funil tem mais de um responsável, e mutation chamando `sendSubmissionToFunnel`, invalidando `submissions`, `pipeline` e `crm-tasks`.
- `src/routes/_authenticated/dashboard.tsx` e `getDashboardStats`: remove o card "Quem mais efetivou (Efetivação)" e o retorno `enrollers` (os três cards viram dois na linha).
- Sem alteração de banco: `submissions.enroller_id` e `presenters.kind = 'efetivacao'` continuam existindo, apenas deixam de ser usados.
