# Indicadores da tela Início com a mesma altura

## Como fica

- Na linha "Como conheceu a escola / Série de interesse / (Matrículas efetivadas + Motivos de perda)", os três blocos passam a ter **exatamente a mesma altura**; os dois cards da terceira coluna dividem esse espaço entre si.
- Na linha dos três "Quem mais..." (Secretaria, Coordenação, Efetivação), todos ficam com a **mesma altura**, definida pelo maior gráfico entre eles — hoje cada um tem a altura da própria lista.
- O conteúdo dos cards se distribui no espaço (título fixo no topo, gráfico ocupando o restante), sem nomes cortados nem valores espremidos.
- Em telas menores, onde os blocos empilham, cada card volta à altura natural do conteúdo.

## Detalhes técnicos

- `src/routes/_authenticated/dashboard.tsx`:
  - Grid de três colunas: remover `items-start` para os filhos esticarem até a altura da linha; Cards com `h-full` e layout interno em flex (título fixo, área do gráfico `flex-1`).
  - Coluna aninhada (Matrículas efetivadas + Motivos de perda): virar `flex flex-col` com os dois cards em `flex-1`, dividindo a altura do bloco.
  - `SeriesChart`: nova prop opcional `chartHeight`; na linha dos três "Quem mais...", calcular a altura comum `Math.max(208, ...[attendants, presenters, enrollers].map(d => d.length * 38))` e passar aos três.
  - Cards de fontes, série e motivos usam o container do gráfico com altura 100% da área disponível quando esticados.
- Nenhuma alteração no banco, nos dados ou nos cálculos.
