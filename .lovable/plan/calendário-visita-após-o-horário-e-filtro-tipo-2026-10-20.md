# Calendário: "Visita" após o horário e filtro Tipo

## O que muda
- Cada agendamento no Calendário passa a mostrar o tipo logo depois do horário, por exemplo **"09:00 - Visita"**, e embaixo vêm o ID e o nome. Isso vale nas visões Mês, Semana e Dia.
- Volta o filtro **Tipo**, com as opções **Visita** e **Matrícula**, ao lado dos filtros Unidade e Situação. É possível marcar uma ou as duas opções.
- Hoje o Calendário só tem visitas, então a opção Matrícula já aparece, mas não mostra nenhum item. Quando os agendamentos de matrícula entrarem, numa etapa futura, vão aparecer como **"10:00 - Matrícula"** e seguir esse mesmo filtro.
- As cores da situação continuam iguais: laranja para Agendada, verde para Realizada e vermelho para Não realizada.

## Detalhes técnicos
- `calendario.functions.ts`: adicionar o campo `kind: "visita" | "matricula"` em `CalendarEvent`. Por enquanto, todos os eventos voltam com `"visita"`.
- `calendario.tsx`: criar o mapa `KIND_LABEL` e o estado `kinds`, que começa com as duas opções marcadas. Os eventos são filtrados por `kinds.includes(e.kind)`. O `chip` mostra `HH:mm - {KIND_LABEL[kind]}` em negrito, com o título logo abaixo.
