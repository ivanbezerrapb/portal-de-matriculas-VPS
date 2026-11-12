# Diálogo de visualização: crianças em lista, uma abaixo da outra

## Problema
Na janela de visualização dos dados preenchidos (ícone de olho na Lista de Visitantes), o campo "Quantidade de Crianças" mostra o JSON bruto (`[{"nome":...,"nascimento":...,"serie":...,"turno":...}]`) em vez de texto legível.

Causa: a função `formatFieldValue` em `src/routes/_authenticated/cadastros.tsx` (linhas ~970–981) trata valores que começam com `{` (endereço) e texto separado por " | ", mas não trata valores que começam com `[` (lista de crianças gravada como JSON).

## Correção (só front-end, um arquivo)

Em `src/routes/_authenticated/cadastros.tsx`, dentro de `formatFieldValue`:

- Adicionar tratamento para valor que começa com `[`: fazer parse do JSON com `parseChildren` (já existente em `@/lib/ext/model`).
- Se a lista parseada vier vazia (JSON inválido), cair no comportamento atual (split por " | ").
- Para cada criança, gerar uma linha no mesmo formato usado na ficha impressa (`BlockView.tsx`): `Nome (dd/mm/aaaa) - Série - Turno`, com data convertida de `aaaa-mm-dd` para `dd/mm/aaaa` (pequeno formatador local) e ignorando partes vazias.
- Cada criança já é renderizada uma abaixo da outra pelo `<dd>` existente (mapeia `lines` em `<div>`), então basta corrigir a formação das linhas — nenhuma mudança de layout.

## Não muda
- Banco de dados, permissões, impressão, CRM, tela Início — nada é afetado.
- Os demais campos (endereço, texto múltiplo) continuam como estão.
