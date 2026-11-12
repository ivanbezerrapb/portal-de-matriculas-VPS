# Visitantes por bairro: grade 2×2 e rótulos sem cortes

## O que mudar

O card "Visitantes por bairro" (tela Início) tem dois problemas, ambos em `src/routes/_authenticated/dashboard.tsx`:

1. As seções de cada unidade estão empilhadas (uma abaixo da outra) quando a tela está estreita; com 4 escolas o usuário quer 2 colunas × 2 linhas.
2. Nomes de bairros longos estão sendo cortados (ex.: "…dade dos Colibris") porque a área reservada ao rótulo é fixa (150px) e a quebra de linha acontece só a cada 28 caracteres.

## Alterações (só no card de bairros; nada mais muda)

**Grade 2×2:**
- Trocar `grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]` por duas colunas fixas a partir de tela pequena: `grid-cols-1 min-[520px]:grid-cols-2`.
- Com 4 unidades fica 2×2; com 3 unidades fica 2 em cima e 1 embaixo; no celular empilha.

**Rótulos sem corte:**
- Permitir que `SeriesTick` receba um limite de caracteres por linha (`maxChars`); o card de bairros usará ~16 caracteres por linha, quebrando "Cristo Redentor — João Pessoa" em 2–3 linhas curtas em vez de uma linha longa cortada.
- Aumentar a largura reservada ao eixo de rótulos de 150 para ~190px, calculada pelo texto mais longo de cada unidade (mesma fórmula já usada em `SeriesChart`), para que o texto completo caiba.
- Ajustar a altura do gráfico por unidade para `itens × 46px` (mínimo 140), acomodando rótulos de 2–3 linhas sem sobreposição.
- O texto continua se ajustando automaticamente: nunca é cortado, apenas quebra em mais linhas.

## Sem alteração
- Banco de dados, consultas e cálculo dos indicadores.
- Demais cards e gráficos da tela Início.

## Validação
- prettier / tsgo / git diff --check.
- Conferência visual no preview (logado como Administrador) com o filtro de escolas marcando todas as unidades.
