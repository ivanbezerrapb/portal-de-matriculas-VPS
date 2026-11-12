# Calendário: botão Tela cheia para acompanhar na TV

## O que muda
- Um novo botão **Tela cheia** fica ao lado dos botões Mês, Semana e Dia.
- Ao clicar, o Calendário ocupa a tela inteira do monitor ou da TV. A barra de menu e a barra do navegador somem, e os filtros, os botões de navegação e os agendamentos continuam visíveis.
- Para sair, use o botão **Sair da tela cheia** ou a tecla Esc.
- **Atualização automática:** o Calendário busca as novidades sozinho a cada 30 segundos, como hoje, inclusive em tela cheia. Agendamentos novos e check-ins aparecem sem ninguém mexer.
- Na visão Mês em tela cheia, os dias ficam mais altos para aproveitar a tela e mostrar mais agendamentos por dia.

## Detalhes técnicos
- `calendario.tsx`: criar uma `ref` no contêiner da página e usar `requestFullscreen()` e `document.exitFullscreen()`. Ouvir `fullscreenchange` para guardar o estado `isFullscreen`.
- Em tela cheia, o contêiner recebe `bg-background overflow-auto h-screen`, e os dias do mês passam a mostrar até 6 itens em vez de 3.
- A consulta ganha `refetchIntervalInBackground: true`, mantendo o intervalo de 30 segundos.
- Ícones `Maximize`/`Minimize` do lucide-react.
