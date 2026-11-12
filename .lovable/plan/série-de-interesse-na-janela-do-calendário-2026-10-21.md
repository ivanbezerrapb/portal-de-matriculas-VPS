# Série de interesse na janela do Calendário

## Resultado
Ao clicar num agendamento do Calendário, a janela mostra, logo abaixo de "Unidade", a linha **Série:** com a série de interesse do lead (uma por criança, separadas por vírgula; "—" se não informada). Vale para visitas e matrículas.

## Detalhes técnicos
- `calendario.functions.ts` (`listCalendarEvents`): para os eventos com `submission_id`, buscar em `submission_values` as respostas dos campos `children` (via `parseChildren`) e perguntas de série separadas, com a mesma regra já usada no cartão do Pipeline (`series` em `pipeline.functions.ts`); retornar `series: string[]` em cada evento.
- `calendario.tsx`: adicionar a linha "Série:" na janela de detalhe, tratando `series ?? []`.
- Sem mudança no banco nem nas permissões.
