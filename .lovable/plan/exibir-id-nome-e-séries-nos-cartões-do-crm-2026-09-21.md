# Exibir ID, nome e séries nos cartões do CRM

## Resultado esperado

Nos cartões do Pipeline vinculados a um formulário:

- O título será exibido como **ID + Nome**. Exemplo: `4001/EX2027 · Maria Silva`.
- Logo abaixo, aparecerá **Série:** com uma ou várias séries informadas no formulário.
- Quando houver mais de uma série, elas serão exibidas de forma legível, sem cortar os nomes.
- Cartões criados manualmente continuarão usando o nome digitado, pois não possuem respostas de formulário vinculadas.

## Implementação

1. Ampliar a consulta do Pipeline para buscar, nos cadastros vinculados, o nome selecionado na configuração de Destino e as séries preenchidas.
2. Reconhecer séries tanto no campo de alunos/crianças quanto em perguntas separadas de série, mantendo a mesma regra já usada na Lista de LEADS.
3. Montar o título visual com o ID do cadastro e o nome encontrado, inclusive para cartões existentes que hoje mostram somente o ID.
4. Exibir as séries abaixo do título do cartão, antes da etapa e da próxima atividade.
5. Manter telefone, responsável, tarefas, movimentação e demais comportamentos do CRM sem alterações.

## Validação

- Conferir um cartão da Lista de LEADS com um aluno.
- Conferir um cartão com vários alunos e séries diferentes.
- Conferir um cartão manual sem cadastro vinculado.
- Validar que títulos e séries quebram linha corretamente em telas menores.
