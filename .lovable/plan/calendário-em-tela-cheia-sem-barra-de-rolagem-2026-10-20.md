# Calendário em tela cheia sem barra de rolagem

## O que muda
- Em tela cheia, o Calendário passa a caber exatamente na altura da tela: cabeçalho, filtros e todas as semanas do mês ficam visíveis sem precisar rolar.
- As semanas do mês dividem igualmente a altura que sobra, tanto em meses de 5 quanto de 6 semanas. Na visão Semana, os dias ocupam a altura toda.
- Os espaços em volta e entre os filtros ficam um pouco menores para sobrar mais área para os agendamentos.
- Se um dia tiver mais agendamentos do que cabem, aparece **"+N mais"** em vez de esticar a tela. Clicar nele abre o dia.
- Na visão Dia, a lista rola só dentro do quadro, se for muito longa, e a página continua sem rolar.
- Fora da tela cheia, nada muda.

## Detalhes técnicos
- `calendario.tsx`: em tela cheia, o contêiner raiz vira `flex h-screen flex-col gap-2 overflow-hidden p-3`, e o `Card` fica com `flex-1 min-h-0`.
- A grade usa `h-full` com `gridTemplateRows: auto repeat(nSemanas, minmax(0,1fr))`, e as células ficam com `min-h-0 overflow-hidden`, sem os `min-h-*` fixos.
- `maxPerDay` em tela cheia é calculado pela altura da célula: medir com um `ResizeObserver` e dividir pela altura de um item, com mínimo de 1. A sobra vai para o "+N mais", e o mesmo limite vale na visão Semana.
- Na visão Dia, o quadro fica com `overflow-auto`.
