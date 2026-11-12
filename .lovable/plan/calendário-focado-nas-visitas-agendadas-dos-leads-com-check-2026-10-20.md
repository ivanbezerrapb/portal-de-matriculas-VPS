# Calendário focado nas visitas agendadas dos LEADS, com check-in

## O que muda
- **Só visitas de LEADS:** o Calendário mostra apenas as visitas agendadas nos cartões de LEADS do Pipeline. As matrículas e o filtro "Tipo" saem por enquanto e voltam numa próxima etapa.
- **Situação de cada visita, por cor:**
  - Laranja = **Agendada**
  - Verde = **Realizada** (check-in confirmado), com data e hora do check-in
  - Vermelho = **Não realizada** (data passou sem check-in)
- Filtro de **Unidade** mantido, e um novo filtro de situação: Agendadas / Realizadas / Não realizadas.

## Quem vê e o que pode fazer
- **Secretaria:** vê todas as visitas da sua unidade, mesmo sem acesso ao Pipeline. Ao clicar na visita, aparece o botão **Dar check-in**, que abre a confirmação "Confirmar check-in?" (a mesma regra da Lista de LEADS: é definitivo).
- **Check-in:** marca o LEAD como check-in feito na Lista de LEADS, dá **ganho** no cartão do Pipeline e conclui as tarefas pendentes, como já acontece hoje.
- **Central de Informações:** vê as visitas dos seus funis e acompanha quando ficam verdes ("Realizada em 22/10 às 14:10").
- **Administrador e Gerente:** veem e podem dar check-in nas suas unidades. **Direção:** só visualiza.
- Atualiza sozinho a cada 30 segundos, para todos verem o agendamento e o check-in sem recarregar.

## Detalhes técnicos
- `calendario.functions.ts`: remover matrículas; buscar oportunidades com `visit_at` e `submissions.list_type='leads'` via `extAdmin()`, filtradas pelas escolas do usuário (admin/direção: todas; gerente/secretaria: suas escolas; central: `school_id` em `infoSchools` e `funnel_id` em `funnelIds`). Retornar `submission_id`, `checked_in_at` (de `audit_log` action `check_in`), `status` (`scheduled|done|missed`) e `can_check_in` (admin, gerente ou secretaria da escola, sem check-in).
- Check-in reaproveita `setLeadCheckIn` de `cadastros.functions.ts` (já valida permissão, dá ganho e conclui tarefas); invalidar `["calendar"]`, `["pipeline"]`, `["submissions"]`.
- `calendario.tsx`: tirar o filtro Tipo, adicionar o filtro de situação, as cores por status e o botão/diálogo de check-in no resumo do evento.
