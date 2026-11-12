# Agendar data já move o cartão de etapa

## O que muda
- No painel do cartão do Pipeline, ao clicar em **Agendar visita** (funis Novo Lead), o cartão vai automaticamente para a etapa **Visita agendada**.
- Ao clicar em **Agendar matrícula** (funis Pós Visita), o cartão vai automaticamente para a etapa **Matrícula agendada**.
- Vale para todos que já podem agendar (Central, Gerente, Secretaria, Administrador), em todas as escolas.
- Se o cartão já estiver nessa etapa, só a data é atualizada.
- Remover a data não muda a etapa.
- O cartão entra no fim da coluna de destino; o Pipeline atualiza na hora.
- Fica registrado no Histórico: "Visita/Matrícula agendada para DD/MM às HH:mm — por Nome".
- Se o cartão ainda não teve o responsável confirmado, o responsável atual é mantido e passa a contar como confirmado (sem abrir a janela de confirmação).

## Detalhes técnicos
- `setOpportunityVisit` (pipeline.functions.ts): após gravar `visit_at` não nulo, buscar etapas do funil; achar etapa cujo nome normalizado contenha "visita agendada" (lista LEADS) ou "matricula agendada" (Pós Visita); se `stage_id` diferente, atualizar `stage_id`, `position` = última+1 e `owner_confirmed_at` (se nulo e houver owner). Inserir nota em `crm_notes`.
- O arraste manual para essas etapas continua abrindo a janela de data como hoje.
- Front: invalidar a query do pipeline após o agendamento.
