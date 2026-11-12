# Pendências reaparecendo a cada 1 hora

## Situação atual (já funciona assim)
- A janela só fecha pelo botão "Lembrar depois".
- Ao clicar, ela some por 1 hora. O sistema confere a cada minuto e, passada 1 hora, reabre sozinha se ainda houver pendências.
- Se não houver mais pendências, ela não abre.
- Logoff e login fazem a janela aparecer de novo na hora.

## Pequeno ajuste proposto
- No momento de reabrir após 1 hora, atualizar as duas listas ("Visitas sem funil" e "Agendamentos sem resposta") antes de mostrar a janela, para que ela traga sempre os dados mais recentes e não reabra com itens já resolvidos.

## Detalhes técnicos
- Em `PendingTasksDialog.tsx`, quando o adiamento expirar, chamar `refetch()` dos hooks `usePendingFunnel` e `usePendingAttendance` e só abrir se o total continuar maior que zero.
