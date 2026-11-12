# Corrigir erro ao enviar formulário ("part" nulo)

## O que está acontecendo

Ao enviar o cadastro aparece a mensagem vermelha sobre a coluna "part". Depois da mudança que passou a guardar o endereço em partes separadas, cada resposta gravada precisa dizer a qual parte pertence. As respostas comuns (nome, telefone, crianças...) estão sendo enviadas sem essa indicação, e o banco recusa o envio inteiro.

## Correção

- Toda resposta comum passa a ser gravada com a parte vazia (indicando "resposta principal"), e só as linhas de endereço levam CEP, Rua, Número etc.
- Vale para os três caminhos que gravam respostas: envio do formulário público, edição do cadastro pelo painel e o campo automático de quantidade de crianças.

## Conferência

- Enviar de novo o formulário "Matrículas Centro" com o campo Endereço preenchido e confirmar que o cadastro é criado.
- Abrir o cadastro criado e conferir que o endereço aparece parte por parte.

## Detalhes técnicos

- `src/lib/ext/publico.functions.ts`: incluir `part: ""` na linha principal do `flatMap` (PostgREST usa a união das chaves do array e preenche as ausentes com NULL, ignorando o DEFAULT — por isso o erro só aparece quando há endereço junto).
- `src/lib/ext/cadastros.functions.ts` (upsert por campo, ~linha 190): incluir `part: ""`.
- `src/lib/ext/server.ts` `writeChildrenCountValue`: incluir `part: ""` no upsert.
