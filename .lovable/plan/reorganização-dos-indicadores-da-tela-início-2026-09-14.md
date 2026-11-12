# Reorganização dos indicadores da tela Início

## Nova ordem da tela

1. Manter o cabeçalho, o filtro de escolas e os três cards anuais atuais.
2. Logo abaixo, exibir **Total de cadastros por escola** em um gráfico de barras comparativo.
3. Na linha seguinte, organizar três colunas:
   - **Como conheceu a escola**;
   - **Série de interesse**;
   - **Matrículas efetivadas** e **Motivos de perda**, um abaixo do outro, como estão atualmente.
4. No celular, os blocos serão empilhados sem ocultar nomes, legendas ou valores.

## Total de cadastros por escola

- Substituir a lista atual de “Cadastros por escola” por um gráfico de barras agrupadas, semelhante à referência enviada.
- Mostrar duas barras para cada unidade:
  - **Total de visitas**: quantidade de cadastros;
  - **Total de crianças**: soma das crianças informadas nesses cadastros.
- Exibir o nome completo da unidade e os valores de cada barra.
- Manter detalhes ao passar o cursor e o estado vazio quando não houver dados.
- O gráfico seguirá o filtro de uma ou várias escolas e o período da campanha vigente (01/08 a 31/07).

## Três colunas de indicadores

- Redimensionar **Como conheceu a escola** para ocupar o primeiro card, preservando o gráfico de pizza, as cores e a legenda completa.
- Redimensionar **Série de interesse** para ocupar o segundo card, preservando a ordem decrescente e todos os nomes completos; ajustar altura e largura internas quando necessário para evitar cortes.
- Na terceira coluna, manter o card compacto de **Matrículas efetivadas** e, abaixo dele, o gráfico de pizza de **Motivos de perda**.
- Os três blocos terão alinhamento e largura visual consistentes.

## Detalhes técnicos

- Ampliar cada item de `bySchool` retornado por `getDashboardStats` para `{ name, visits, children }`.
- Relacionar as respostas internas de quantidade de crianças aos respectivos cadastros e acumular o total por `school_id`, além do total geral já existente.
- Substituir a lista final em `dashboard.tsx` por um `BarChart` vertical com duas séries, legenda e rótulos de valor.
- Reorganizar o grid principal para o comparativo ocupar toda a largura e os demais indicadores formarem três colunas em telas grandes.
- Nenhuma alteração no banco, nos formulários ou nas regras de cálculo existentes.
