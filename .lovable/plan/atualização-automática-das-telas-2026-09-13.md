# Atualização automática das telas

Hoje as listas só buscam dados quando a página é carregada. Se a aba fica aberta por horas, o conteúdo congela.

## O que muda

- **Cadastros** e **CRM (Pipeline, Tarefas)** passam a se atualizar sozinhos:
  - a cada 30 segundos enquanto a tela estiver aberta;
  - imediatamente quando você volta para a aba do navegador;
  - imediatamente quando a internet reconecta.
- A atualização é silenciosa: nada pisca, não aparece tela de carregando, e o que você estiver arrastando ou digitando não é interrompido.
- Listas de apoio que quase não mudam (escolas, formulários, motivos, permissões) continuam como estão, para não gastar recursos à toa.

## Detalhes técnicos

- Em `src/router.tsx`, nos `defaultOptions.queries`: `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `staleTime: 15_000`.
- Nas queries de dados vivos — `submissions` (`cadastros.tsx`), `pipeline` e tarefas da oportunidade (`crm.pipeline.tsx`), `crm-tasks` (`crm.tarefas.tsx`) — adicionar `refetchInterval: 30_000` e `refetchIntervalInBackground: false`.
- Usar `isLoading` (não `isFetching`) para os estados de "carregando", garantindo que a revalidação em segundo plano não mostre skeleton nem apague a lista.
- No Pipeline, pausar o `refetchInterval` enquanto houver arraste ativo ou painel de oportunidade aberto em edição, evitando que o cartão salte durante a ação.
- Queries de cadastro/configuração (`schools`, `forms`, `templates`, `funnels`, `my-permissions`, motivos) ficam sem intervalo.
