# Usar toda a largura da tela na Lista de cadastros

## Objetivo

Acabar com a barra de rolagem horizontal na Lista de cadastros aproveitando o espaço vazio das laterais, deixando todas as colunas visíveis de uma vez.

## O que muda na prática

1. **Página ocupa toda a largura disponível** — hoje o conteúdo da Lista de cadastros fica preso numa faixa central estreita. Ela passa a usar a largura inteira entre o menu lateral e a borda direita da tela.
2. **Tabela sem rolagem lateral em telas comuns** — a largura mínima fixa da tabela é removida; as colunas (Responsável, Escola, Crianças, Data, Atendimento, Apresentação, Efetivação, Matrícula) se ajustam para caber na largura disponível, com textos longos quebrando em duas linhas em vez de esticar a tabela.
3. **Em telas muito estreitas** (celular, janela pequena) a rolagem lateral continua existindo como recurso de segurança — ela só desaparece quando há espaço suficiente.

## Detalhes técnicos

- Em `src/routes/_authenticated/cadastros.tsx`:
  - Trocar o container `mx-auto max-w-5xl` por largura total (`w-full`), mantendo o respiro lateral que o layout já dá.
  - Remover `min-w-[760px]` da tabela; manter `overflow-x-auto` no contêiner apenas como proteção em telas pequenas.
  - Garantir que as colunas de texto (Responsável, nomes de Atendimento/Apresentação/Efetivação) quebrem linha (`break-words`) em vez de forçar largura extra.
- Nenhuma mudança no banco de dados, nas permissões ou no conteúdo da página — somente layout/largura.

## Validação

- Abrir a Lista de cadastros como Administrador no preview e conferir que, na largura normal, não aparece barra de rolagem horizontal e todas as 8 colunas ficam visíveis.
- Conferir também com perfil de Secretaria (sem o filtro de escola) para garantir que nada quebrou.
- Rodar as verificações de código de sempre (formatação, tipos, lint).
