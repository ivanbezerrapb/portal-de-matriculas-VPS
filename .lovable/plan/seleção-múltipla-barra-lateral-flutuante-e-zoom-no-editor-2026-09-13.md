# Seleção múltipla, barra lateral flutuante e zoom no editor

## 1. Selecionar vários itens

- Clicar com **Ctrl** (ou **Shift**) adiciona/remove um bloco da seleção.
- Arrastar em uma área vazia da folha desenha um retângulo de seleção; tudo que ficar dentro é selecionado.
- Arrastar qualquer bloco selecionado move **todos** os selecionados juntos, respeitando o alinhamento à grade.
- **Delete** / **Backspace** apaga todos os selecionados; um botão "Excluir selecionados (N)" também aparece na barra.
- As setas do teclado deslocam a seleção em 1 mm (5 mm com Shift).
- Com vários selecionados, o painel lateral mostra as ações em lote (mover por valor, duplicar, excluir); com apenas um, continua mostrando todas as propriedades como hoje.
- Clique em área vazia (sem arrastar) limpa a seleção.

## 2. Barra lateral flutuante

- O painel de propriedades passa a acompanhar a rolagem da página (fica fixo no topo da área visível) em telas largas.
- Altura limitada à tela, com rolagem interna própria quando o conteúdo for maior.
- Em telas estreitas continua abaixo da folha, sem fixar.

## 3. Controle de zoom

- Botões **−** e **+** ao lado do seletor de zoom, com o percentual atual exibido entre eles.
- Faixa de 25% a 400%, em passos suaves; um botão volta ao "Ajustar à tela".
- **Ctrl + roda do mouse** sobre a folha também aproxima/afasta, mantendo o ponto sob o cursor parado.

## Detalhes técnicos

- Em `src/components/print/LayoutEditor.tsx`: trocar `selectedId: string | null` por `selectedIds: string[]`; helpers `updateBlocks(ids, patch)` e `removeBlocks(ids)`.
- Arrasto em lote: guardar as posições originais de todos os selecionados no `pointerdown` e aplicar o mesmo delta a cada um.
- Marquee: `pointerdown` no canvas vazio → retângulo em mm; interseção de retângulos define a seleção.
- Zoom: estado `"fit" | number` mantido; `ResizeObserver` continua para o modo "fit". Roda do mouse via listener nativo não-passivo com `preventDefault`, escala por `Math.exp(-dy * 0.0015)` e ajuste de `scrollLeft`/`scrollTop` do viewport para ancorar no cursor.
- Inspetor: wrapper com `lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-y-auto`; em tela cheia mantém a coluna fixa já existente.
- Sem alteração no banco de dados nem no formato salvo do modelo.
