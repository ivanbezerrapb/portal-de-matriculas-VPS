# Otimização e novos indicadores da tela Início

Reorganizar a tela Início para ocupar menos altura e incluir indicadores de interesse, matrículas e origem dos cadastros, todos reagindo à seleção de escolas.

## Cabeçalho e filtro compacto

- Remover o título “Início” e o texto “Acompanhe as visitas recebidas pelas escolas”.
- Manter apenas **VISÃO GERAL**, alinhado no canto superior esquerdo da área de conteúdo.
- Substituir os botões atuais de escolas por um seletor de lista no canto superior direito.
- O seletor permitirá marcar uma ou várias escolas; sem nenhuma seleção, mostrará **Todas as escolas**.
- Mostrar no próprio seletor um resumo da escolha, evitando ocupar uma linha inteira.
- No celular, “VISÃO GERAL” e o seletor poderão ficar em linhas separadas para não apertar o conteúdo.

## Cards anuais mais compactos

- Subir os três cards anuais para logo abaixo do cabeçalho.
- Reduzir espaços internos e verticais, mantendo legíveis os totais de visitas e crianças.
- Preservar os dados atuais de **2027 (2026)** e os valores em branco de **2026 (2025)** e **2025 (2024)**.

## Novos indicadores

### Série de interesse

- Exibir um gráfico de barras com a quantidade de crianças por série.
- Ler a série de cada criança armazenada nos campos do tipo **N Filhos**.
- Cada criança conta uma vez na série informada; respostas vazias não entram no gráfico.
- Ordenar as séries pela ordem configurada nos formulários quando disponível, mantendo categorias não previstas ao final.

### Matrículas efetivadas

- Exibir o total de cadastros com **Matrícula** marcada.
- Exibir também o percentual: `cadastros matriculados ÷ total de crianças × 100`.
- Quando não houver crianças no filtro, mostrar **0%** para evitar divisão inválida.

### Como conheceu a escola

- Exibir um gráfico de barras com a quantidade de respostas por origem.
- Localizar automaticamente, em cada formulário, o campo cujo nome contém **“Como conheceu”**, sem diferenciar maiúsculas, acentos ou texto complementar.
- Respostas de múltipla escolha contam uma vez em cada opção marcada; respostas vazias não entram no gráfico.

## Reação aos filtros

- Visitas, crianças, cards anuais, série de interesse, matrículas, “como conheceu” e cadastros por escola usarão exatamente as mesmas escolas selecionadas.
- Os indicadores continuarão considerando os cadastros realizados no ano civil vigente, como já ocorre hoje.
- A atualização será silenciosa, mantendo a tela estável durante a troca de filtro.

## Organização visual

- Após os cards anuais, organizar os novos indicadores em uma grade compacta: gráfico de séries com maior largura, card de matrículas ao lado e gráfico “Como conheceu a escola” abaixo ou ao lado conforme o espaço disponível.
- No celular, todos os indicadores serão empilhados e os gráficos terão rótulos legíveis.
- Manter “Cadastros por escola” no final da tela, também reagindo ao filtro.

## Detalhes técnicos

- Ampliar `getDashboardStats` para retornar, além de `visits`, `children` e `bySchool`:
  - `series: { label, count }[]`, extraído dos JSONs dos campos `children` dos cadastros filtrados;
  - `enrollments: { total, percentage }`, usando `submissions.enrolled` e o total de crianças como denominador;
  - `sources: { label, count }[]`, obtido dos campos cujo rótulo normalizado contém “como conheceu”.
- Consultar somente respostas dos cadastros já limitados pelo ano e pelas escolas permitidas ao usuário.
- Atualizar `dashboard.tsx` com um seletor múltiplo compacto e gráficos de barras construídos com os componentes e tokens visuais existentes, sem alteração de banco.
