# Remover folhas em branco na impressão das fichas

## Causa provável
- Na impressão, o restante do portal (menu, lista, telas) só fica **invisível**, mas continua ocupando espaço. O navegador conta esse espaço e gera folhas extras em branco.
- Toda ficha força "quebra de página depois", inclusive a última, o que cria mais uma folha vazia no fim.
- Cada folha tem exatamente a altura do papel; pequenas diferenças de arredondamento fazem o conteúdo "transbordar" alguns décimos e empurrar uma folha em branco extra.

## Correção
1. Na impressão, esconder de fato o restante do portal (sem ocupar espaço), deixando somente as fichas.
2. Aplicar a quebra de página apenas entre fichas, nunca depois da última.
3. Reduzir minimamente a altura da folha impressa (fração de milímetro) e cortar qualquer sobra, para não gerar folha extra por arredondamento.
4. Vale para o modelo visual (Interactivo e Conecta) e o modelo simples; não muda layout, conteúdo nem os modelos salvos.

## Validação
- Imprimir 1 e várias fichas do modelo Interactivo e conferir na prévia do navegador: número de folhas = fichas × páginas do modelo, sem folhas vazias.

## Detalhes técnicos
- `PrintSheets.tsx` (printCss): trocar `body * { visibility: hidden }` por ocultar com `display:none` os irmãos fora de `.print-shell` (ex.: `body:has(#print-area) > *:not(...)`) ou tornar `#print-area` `position: static` com `html, body { height:auto; overflow:visible }` e esconder o app shell; `.print-page { break-after: page }` + `.print-page:last-child { break-after: auto }`; `.print-page { height: calc(<h>mm - 0.5mm); overflow:hidden }` no print.
