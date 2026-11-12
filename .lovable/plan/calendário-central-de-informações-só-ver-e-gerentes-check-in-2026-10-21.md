# Calendário: Central de Informações (só ver) e Gerentes (check-in e faltas)

## Situação atual
- O menu Calendário já aparece para todos os perfis.
- Central de Informações hoje só vê os agendamentos dos funis ligados a ela.
- Gerentes já veem os agendamentos da unidade e têm os botões Dar check-in, Faltou e Matriculado, igual à Secretaria.

## O que muda
- **Central de Informações:** passa a ver todos os agendamentos (visitas e matrículas) das unidades dela, de todos os funis, não só dos seus. Somente visualização: nenhum botão de check-in, Faltou ou Matriculado.
- **Gerentes:** continuam vendo e dando check-in, Faltou e Matriculado nos agendamentos da própria unidade (mantido e conferido).
- Demais perfis sem mudança.

## Detalhes técnicos
- `calendario.functions.ts` (`listCalendarEvents`): remover a exigência `funnelIds.includes(o.funnel_id)` para `infoSchools`; manter filtro por unidade. `can_check_in` continua só Admin/Gerente/Secretaria.
- Ações (`markVisitNoShow`, check-in, `markEnrollmentDone`) já recusam Central no servidor; sem alteração.
