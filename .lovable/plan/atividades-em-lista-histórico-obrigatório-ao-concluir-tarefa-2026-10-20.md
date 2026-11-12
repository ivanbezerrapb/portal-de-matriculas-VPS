# Atividades em lista + Histórico obrigatório ao concluir tarefa

## 1. Lista de atividades (sem campo livre)
- No cartão do Pipeline, o campo "Nova tarefa..." vira uma lista de seleção com as atividades cadastradas.
- Lista inicial: 1º Contato, 2º Contato, 3º Contato, Enviar E-mail, Fazer Ligação.
- Data continua como hoje; botão Adicionar só ativa com uma atividade escolhida.
- Tarefas automáticas (ex.: "1º CONTATO", "Visita agendada") e tarefas antigas continuam como estão.

## 2. Nova tela CRM › Atividades (só Administrador edita)
- Mesmo modelo da tela Motivos: adicionar, renomear, reordenar, ativar/desativar e excluir.
- Atividades desativadas somem da lista, mas tarefas já criadas mantêm o nome.

## 3. Histórico obrigatório ao concluir
- Ao marcar uma tarefa como feita (no cartão ou em CRM › Tarefas), abre uma janela "Concluir tarefa" com caixa de texto obrigatória: o que foi feito e como foi.
- Sem texto, não conclui. Ao confirmar, a tarefa fica feita e o texto entra no Histórico do cartão com nome, data e hora, no formato: "Concluiu 1º Contato: <texto>".
- Reabrir tarefa não pede texto.
- Conclusões automáticas (check-in, ganho, matrícula) continuam sem pedir texto.

## Detalhes técnicos
- Banco externo: tabela `crm_task_types` (id, label, position, active, created_at) com GRANTs, RLS (leitura autenticados, escrita admin) e as 5 atividades iniciais.
- `src/lib/ext/atividades.functions.ts`: listar ativos e CRUD admin.
- `tarefas.functions.ts`: `setTaskDone` passa a exigir `note` (min 1) quando `done=true` e grava em `crm_notes` com nome do autor.
- `crm.pipeline.tsx` (`OpportunityTasks`): Select no lugar do input; diálogo de conclusão; invalida `["crm-notes", id]`.
- `crm.tarefas.tsx`: mesmo diálogo no checkbox.
- Nova rota `crm.atividades.tsx` com head() e item no menu CRM (só admin).
