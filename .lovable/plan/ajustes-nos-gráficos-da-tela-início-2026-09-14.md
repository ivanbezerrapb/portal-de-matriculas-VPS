# Ajustes nos gráficos da tela Início

## Série de interesse

- Ordenar as séries pela quantidade de crianças, da maior para a menor.
- Exibir o nome completo de cada turma ao lado da barra, sem abreviação nem reticências.
- Reservar espaço suficiente para os nomes e manter o gráfico legível em telas menores.
- Manter a quantidade visível no eixo e no detalhe ao passar o cursor.

## Como conheceu a escola

- Substituir o gráfico de barras por um gráfico de pizza compacto.
- Usar uma cor distinta para cada origem.
- Exibir uma legenda ao lado do gráfico com a cor, o nome completo e a quantidade de cada origem.
- No celular, posicionar a legenda abaixo do gráfico para evitar cortes.
- Manter o detalhe ao passar o cursor e o estado sem respostas.

## Comportamento mantido

- Os dois gráficos continuam reagindo imediatamente ao filtro de uma ou várias escolas.
- Os cálculos continuam considerando somente os cadastros do ano vigente.
- Nenhuma alteração no banco ou nos formulários.

## Detalhes técnicos

- Ordenar `series` por `count` decrescente no resumo do painel, usando o nome como desempate.
- Separar o componente atual de barras em um gráfico horizontal para séries e um gráfico de pizza para origens.
- No gráfico de séries, remover o corte de texto e calcular uma largura adequada para o eixo dos nomes.
- No gráfico de origens, usar `PieChart`, `Pie`, `Cell` e legenda própria com cores semânticas do tema.
