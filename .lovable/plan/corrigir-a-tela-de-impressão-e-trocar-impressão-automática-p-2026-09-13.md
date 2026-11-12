# Corrigir a tela de impressão e trocar impressão automática por pré-visualização

## O problema

A página de impressão quebra ("This page didn't load") porque a tela usa um efeito
(a rotina que dispara a impressão) depois de já ter saído mais cedo nos estados de
"carregando" e "erro". Em React isso é uma violação da ordem dos hooks e derruba a
página inteira assim que os dados chegam — por isso o erro aparece justamente ao
clicar no ícone da impressora.

## O que muda

1. Reorganizar a tela `/imprimir/:templateId` para que todos os hooks
   (`useEffect`, `useCallback`, `useState`) fiquem antes de qualquer retorno
   antecipado. Os estados de carregando/erro passam a ser renderizados como
   conteúdo condicional, não como saída antecipada.
2. Remover a abertura automática da caixa de diálogo da impressora. A nova janela
   passa a mostrar apenas a pré-visualização da ficha, no tamanho real da folha,
   com um botão "Imprimir" para quando o usuário quiser de fato imprimir.
3. Manter o aviso de conteúdo fora da folha e o botão desabilitado enquanto a
   medição dinâmica não terminar.

## Detalhes técnicos

- `src/routes/_authenticated/imprimir.$templateId.tsx`: mover `useEffect` e
  `useCallback` para o topo do componente; derivar `data`, `layout`, `size`,
  `dynamicReady`, `hasOverflow` com guardas nulas; remover o `setTimeout` que
  chama `window.print()` (o `useEffect` pode ser eliminado por completo).
- Nenhuma mudança em funções de servidor, banco ou no editor de layout.
