# Campos autoajustáveis no modelo de impressão

## Objetivo
Fazer os blocos de dados crescerem conforme a quantidade e o tamanho das respostas, sem cortar textos, tabelas ou crianças.

## Comportamento
- Ajustar automaticamente a altura de todos os blocos com dados variáveis: campos do cadastro, tabelas e lista de crianças.
- Na lista **N Filhos**, usar somente as linhas necessárias: uma criança ocupa uma linha; até cinco crianças ocupam cinco linhas.
- Quando um bloco crescer, deslocar para baixo os blocos seguintes que ocupem a mesma faixa horizontal, preservando a distância original entre eles.
- Aplicar o mesmo cálculo no editor, na pré-visualização com cadastro real e na impressão final.
- Nunca ocultar conteúdo excedente dentro de um bloco.

## Limite da página
- Detectar quando o ajuste automático ultrapassar o fim da folha A4/A5.
- Destacar o excesso no editor e mostrar um aviso claro indicando a página que precisa ser reorganizada.
- Na pré-visualização, identificar o cadastro e a página que não cabem.
- Na impressão, não abrir automaticamente a janela enquanto houver conteúdo fora da folha; mostrar o aviso para evitar uma ficha cortada ou incompleta.
- Não criar páginas extras e não reduzir o tamanho do texto automaticamente.

## Editor
- Mostrar a altura real calculada dos blocos usando os dados do cadastro escolhido na pré-visualização.
- Manter a altura configurada manualmente como altura mínima; o bloco poderá crescer, mas nunca encolher abaixo do tamanho definido.
- Exibir uma orientação visual na folha quando o conteúdo ultrapassar seu limite inferior.

## Detalhes técnicos
- Criar um cálculo compartilhado de layout dinâmico para medir o conteúdo renderizado e gerar posições/alturas finais em cascata.
- Considerar somente blocos posicionados abaixo e com interseção horizontal ao propagar o deslocamento, evitando mover colunas independentes.
- Remover o corte por `overflow: hidden` dos blocos variáveis e manter o corte apenas em elementos de tamanho fixo, como imagens e molduras.
- Recalcular após carregamento de dados, mudança de cadastro, alteração do modelo e redimensionamento da visualização.
- Validar cenários com respostas curtas e longas e com listas de 1 e 5 crianças, tanto na pré-visualização quanto na impressão.

## Sem alteração
- O formato salvo do modelo e os cadastros existentes permanecem compatíveis.
- Não haverá mudança no banco de dados nem criação automática de novas páginas.
