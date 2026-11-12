# Pedir a data da visita ao mover para "Visita agendada"

## Como vai funcionar
- Quando um cartão de LEADS é solto numa etapa chamada "Visita agendada", abre a janela **"Agendar visita"** com campo de data e hora (obrigatório).
- **Confirmar:** salva a data, move o cartão e a visita aparece no Calendário.
- **Cancelar:** o cartão volta para onde estava.
- Se o cartão já tem uma visita marcada, a janela abre com essa data preenchida, e dá para manter ou alterar.
- Se for o primeiro arraste do cartão, primeiro aparece a janela "Confirmar responsável", que já existe, e depois a de agendamento.
- Vale para todos os funis de LEADS. A etapa é reconhecida pelo nome, sem diferenciar maiúsculas nem acentos.

## Detalhes técnicos
- `crm.pipeline.tsx`: no `onDrop`, detectar etapa de destino cujo nome normalizado contenha "visita agendada" e cartão com `submission_id` de lista leads; guardar `pendingVisitMove`. Novo diálogo com `datetime-local`; ao confirmar chama `setOpportunityVisit` e depois `moveOpportunity` (ou encadeia após a confirmação de responsável).
- Invalida `["pipeline"]` e `["calendar"]`.
- Sem mudança no banco.
