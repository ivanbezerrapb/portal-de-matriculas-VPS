# Agendar Matrícula (Pós Visita) e etapa "Reagendar Matrícula"

## O que muda
1. **Nova etapa "Reagendar Matrícula"** criada em todos os funis Pós Visita de todas as unidades, logo após "Matrícula agendada" (antes de "Matriculado"). Funis de LEADS não mudam.
2. **Agendar Matrícula:** ao arrastar um cartão Pós Visita para "Matrícula agendada", abre a janela **"Agendar matrícula"** com data e hora obrigatórias (igual à "Agendar visita" dos LEADS). Cancelar devolve o cartão. O cartão Pós Visita também ganha o campo "Data da matrícula".
3. **Calendário:** as matrículas agendadas aparecem como **"HH:mm - Matrícula"**, com ID e nome, respeitando os filtros Unidade e Tipo (Visita / Matrícula) e as mesmas cores de situação.
4. **Faltou na matrícula:** na janela da matrícula no Calendário, a Secretaria vê **Faltou**. Ao confirmar:
   - o cartão vai para **"Reagendar Matrícula"**;
   - o Histórico registra "Faltou à matrícula agendada para DD/MM/AAAA às HH:mm", com nome de quem marcou;
   - a data é apagada e sai do Calendário, para a Central reagendar.
5. **Botão "Matriculado"** (no lugar de "Dar check-in" nas matrículas): abre a confirmação e a janela de quantidade de matrículas (inteiro maior que zero, como já acontece hoje). Ao confirmar:
   - o cartão é dado como **ganho** no funil e vai para a etapa "Matriculado";
   - as tarefas pendentes do cartão são concluídas;
   - o cadastro fica marcado como matriculado na Lista de Visitantes (mesma regra da coluna Matrícula);
   - o Histórico registra "Matriculado na matrícula agendada para DD/MM/AAAA às HH:mm", com nome, data e hora de quem marcou;
   - no Calendário, o item fica verde (Realizada).

## Quem pode
Faltou: Administrador, Gerente e Secretaria da unidade. Central vê as matrículas dos seus funis; Direção só visualiza.

## Resumo
- LEAD: Visita agendada → Faltou → Reagendar visita
- Pós Visita: Matrícula agendada → Faltou → Reagendar Matrícula

## Detalhes técnicos
- Dados: inserir em `funnel_stages` a etapa "Reagendar Matrícula" nos funis com `funnelListType(name)==='visitantes'`, posição após a etapa que contém "matricula agendada" (reposiciona as seguintes); pular funis que já tenham "reagend".
- Reaproveitar `opportunities.visit_at` como data do agendamento (visita para LEADS, matrícula para Pós Visita); sem nova coluna.
- `crm.pipeline.tsx`: detectar destino "matricula agendada" em funil de visitantes; diálogo com título "Agendar matrícula"; campo de data no cartão com rótulo conforme a lista.
- `listCalendarEvents`: incluir `list_type` visitantes com `kind: "matricula"`; `can_check_in` falso para matrícula.
- `markVisitNoShow`: aceitar ambas as listas; procurar etapa com "reagend" + ("visita" ou "matricula") conforme o tipo; texto do histórico conforme o tipo.
- Nova server fn `markEnrollmentDone({ opportunity_id, count })`: mesma permissão do check-in; reaproveita a lógica de `setEnrollment` (ganho, etapa "Matriculado", conclusão de tarefas, `enrolled`/`enrollment_count`), grava evento `enrollment_done` em `audit_log` e nota em `crm_notes`. Situação "done" da matrícula vem desse evento ou de `submissions.enrolled`.
- `calendario.tsx`: botões Faltou e Matriculado nas matrículas; invalida calendário, pipeline, cadastros e notas.
