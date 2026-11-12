# Check-in no Calendário: ganho, tarefas, histórico e etapa

## Situação atual
- O check-in já tenta dar ganho e concluir tarefas, mas o cartão 2002/CR2027 (Isabelle) ficou verde no Calendário e continua aberto em "Visita agendada" no Pipeline. A causa ainda não está confirmada; o primeiro passo é conferir esse cartão no banco (se o ganho foi gravado, se a gravação foi bloqueada por permissão ou se havia mais de um cartão para o mesmo LEAD).
- Os funis Novo Lead não têm etapa de visita realizada.

## O que muda
1. **Nova etapa "Visita realizada"** nos funis Novo Lead das quatro unidades, depois de "Reagendar Visita".
2. **Ao dar check-in no Calendário** (Admin, Gerente e Secretaria da unidade):
   - o cartão vai para "Visita realizada" e é dado como **ganho**;
   - todas as tarefas pendentes e futuras são concluídas;
   - o Histórico do cartão registra "Visita realizada em DD/MM/AAAA às HH:mm — check-in por <nome>".
3. **Cartões ganhos somem do quadro** na situação "Em aberto" (padrão). Continuam acessíveis escolhendo Situação = Ganho.
4. **Correção do caso da Isabelle:** depois do ajuste, aplicar o ganho e a etapa nesse cartão.

## Detalhes técnicos
- `setLeadCheckIn` (`cadastros.functions.ts`): gravar oportunidade/tarefas/nota com `extAdmin()` após validar permissão (evita bloqueio silencioso de RLS); buscar todas as oportunidades do submission (não `maybeSingle`); setar `stage_id` da etapa cujo nome contém "realizada" (fallback: mantém etapa); inserir em `crm_notes`; checar linhas afetadas e lançar erro se zero.
- Migration/insert de etapa "Visita realizada" nos funis com "lead" no nome.
- `listOpportunities` já filtra `status=open` por padrão; confirmar que o quadro não exibe ganhos.
