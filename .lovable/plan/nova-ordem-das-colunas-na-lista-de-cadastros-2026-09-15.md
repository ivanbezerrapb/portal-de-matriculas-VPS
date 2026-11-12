# Nova ordem das colunas na Lista de cadastros

## O que muda

As três colunas de nomes passam a ficar nesta sequência:

1. Apresentação
2. Atendimento
3. Efetivação

Hoje a ordem é Atendimento, Apresentação, Efetivação — ou seja, só trocam de posição Atendimento e Apresentação.

## Como

- `src/routes/_authenticated/cadastros.tsx`:
  - Cabeçalho da tabela (linhas 307–309): trocar a ordem dos `<th>` para Apresentação, Atendimento, Efetivação.
  - Células da tabela (linhas 359–406): mover o bloco da célula `PersonCell kind="coordenacao"` (Apresentação) para antes do bloco `kind="secretaria"` (Atendimento). Nenhuma lógica muda — cada célula continua salvando o tipo certo.
- Sem alteração no banco, nas consultas ou nas regras de permissão.
