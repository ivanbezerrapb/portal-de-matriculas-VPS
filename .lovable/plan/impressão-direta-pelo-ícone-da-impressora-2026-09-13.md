# Impressão direta pelo ícone da impressora

## Objetivo

Ao clicar no ícone de impressora na listagem de cadastros, a janela de impressão do navegador abre diretamente, sem abrir uma nova aba com a ficha. A escolha do modelo (quando houver mais de um) continua aparecendo antes.

## Como vai funcionar

1. Ao clicar no ícone, a ficha do cadastro é montada em segundo plano, dentro da própria tela de cadastros (invisível para o usuário).
2. Assim que a ficha terminar de ser montada e medida (ajuste automático dos campos), a janela de impressão do navegador abre sozinha, já com a ficha pronta — igual à captura enviada.
3. Ao concluir ou cancelar a impressão, a ficha em segundo plano some e a tela de cadastros continua como estava.
4. Se o conteúdo não couber na folha (risco de dados cortados), a impressão não é iniciada e aparece um aviso pedindo para ajustar o modelo.
5. Se houver mais de um modelo de impressão para o formulário, a janelinha de escolha do modelo continua aparecendo antes de imprimir.
6. O botão de impressão em lote (vários cadastros selecionados) continua abrindo a página de impressão como hoje.

## Detalhes técnicos

1. Extrair a montagem da ficha de `src/routes/_authenticated/imprimir.$templateId.tsx` para um componente compartilhado (`src/components/print/PrintSheets.tsx`), reutilizado pela página de impressão e pela listagem — sem duplicar lógica.
2. Em `src/routes/_authenticated/cadastros.tsx`:
   - Substituir o `window.open(...)` por um estado local `{ templateId, submissionId }` que monta o componente de impressão embutido.
   - O componente busca os dados com `getPrintData`, renderiza as páginas com `DynamicPrintPage` (medindo o conteúdo) e aplica o CSS de impressão já existente (`#print-area` visível, restante oculto, `@page` com o tamanho do modelo).
   - Quando todas as páginas estiverem medidas (`ready`) e sem overflow, chamar `window.print()` uma única vez; no evento `afterprint`, desmontar o componente.
   - Overflow ou erro: `toast` de aviso e desmontar sem imprimir.
   - Enquanto carrega, mostrar um indicador discreto ("Preparando impressão...").
3. A rota `/imprimir/$templateId` continua existindo para a impressão em lote, passando a usar o mesmo componente compartilhado.

## Validação

- Testar no navegador (cadastro 0003/CE2027): clicar no ícone → janela de impressão abre com a ficha correta (logo, dados do responsável, tabela de crianças), sem abrir nova aba.
- Cancelar a impressão → volta para a listagem normal.
- `bunx tsgo --noEmit` sem erros.
