# Pendências em uma única página, sem abas

## O que muda
- As abas saem da janela "Pendências". As duas seções ficam uma abaixo da outra, na mesma rolagem:
  1. **Visitas sem funil (N)**
  2. **Agendamentos sem resposta (N)**
- Cada seção tem um título com o total de itens. Quando uma seção não tem nada, aparece "Nada pendente".
- Continua igual: o botão **Lembrar depois** (1 hora), a janela fecha sozinha quando tudo é resolvido e os selos vermelhos dos menus.

## Detalhes técnicos
- `PendingTasksDialog.tsx`: retirar o estado/botões de aba; mostrar `PendingFunnelSection` e depois `PendingAttendanceSection`, cada um com um título fixo no topo.
