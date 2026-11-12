# Painel da oportunidade: crianças uma abaixo da outra

## Contexto
No painel de detalhes da oportunidade (CRM > Pipeline), o campo "Quantidade de Crianças" mostra todas as crianças juntas em uma única linha, separadas por " | " — difícil de ler.

O valor é gravado assim no cadastro (`details`), com cada criança no formato `NOME · nascimento · série · turno`. A correção é apenas na exibição: dividir o texto em itens e listar um abaixo do outro.

## Mudança
`src/routes/_authenticated/crm.pipeline.tsx` — no bloco que renderiza `details` (~linha 418):

- Dividir `d.value` por " | " (o separador usado ao montar os itens).
- Renderizar cada item em sua própria linha (lista vertical), mantendo o rótulo acima.

Cada linha continua mostrando `NOME · nascimento · série · turno`.

- Não muda dados gravados nem outras telas — vale para cadastros novos e antigos.

## Validação
- prettier, tsgo, eslint, git diff --check.
