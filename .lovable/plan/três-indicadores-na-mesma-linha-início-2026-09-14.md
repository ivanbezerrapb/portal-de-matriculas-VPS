# Três indicadores na mesma linha (Início)

## O que muda

Na tela **Início**, os cards "Quem mais atendeu (Secretaria)", "Quem mais apresentou (Coordenação)" e "Quem mais efetivou (Efetivação)" hoje ficam em duas linhas (dois em cima, um embaixo). Passam a ficar **na mesma linha, divididos em 3 colunas iguais**.

## Como

- Em `src/routes/_authenticated/dashboard.tsx` (linhas 466–473): substituir os dois grids `lg:grid-cols-2` por um único grid `lg:grid-cols-3` contendo os três `SeriesChart`.
- Em telas menores que o limite, os cards continuam empilhando (comportamento responsivo já existente).

## Sem mudanças no banco

Nenhuma alteração de dados ou consultas — apenas o layout da tela Início.
