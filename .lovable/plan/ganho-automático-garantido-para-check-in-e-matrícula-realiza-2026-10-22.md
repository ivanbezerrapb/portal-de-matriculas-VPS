# Ganho automático garantido para check-in e matrícula realizada

## O que muda
1. **Varredura e correção de agora** (todas as unidades):
   - LEADS com check-in feito e cartão ainda aberto: dar ganho com a data do check-in, mover para "Visita realizada", concluir tarefas pendentes e registrar no Histórico "Visita realizada em DD/MM/AAAA às HH:mm — check-in por <nome>".
   - Visitantes com matrícula realizada e cartão ainda aberto: dar ganho com motivo "Matrícula realizada", mover para "Matriculado", concluir tarefas e registrar no Histórico.
   - Antes de alterar, listo os cartões encontrados (ID, unidade) e informo no retorno.
2. **Proteção para não acontecer de novo:**
   - Se o cartão for criado ou associado a um funil **depois** do check-in ou da matrícula (ex.: escolheram o funil na lista após o check-in), ele já nasce ganho e na etapa certa.
   - Marcar matrícula pela lista (caixinha) também passa a mover o cartão para "Matriculado", igual ao Calendário.
   - Se a gravação do ganho falhar, o check-in/matrícula não fica pela metade: aparece erro e nada é registrado.
3. **Conferência automática:** sempre que o Pipeline ou o Calendário carregar, cartões abertos cujo cadastro já tem check-in ou matrícula são corrigidos com a mesma regra.

## Detalhes técnicos
- Script de varredura via `extAdmin`: `audit_log action=check_in` × `opportunities status=open` (leads); `submissions.enrolled=true` × `opportunities status=open` (visitantes).
- Extrair helper `closeAsWon(opp, kind, when, author)` em `server.ts`, reutilizado por `setLeadCheckIn`, `markEnrollmentDone`, matrícula pela lista (`cadastros.functions.ts` ~440), envio ao funil e `listOpportunities`/`listCalendarEvents` (autocorreção).
- `setLeadCheckIn`: gravar o ganho antes do `audit_log`; só registrar o check-in se o ganho der certo.
