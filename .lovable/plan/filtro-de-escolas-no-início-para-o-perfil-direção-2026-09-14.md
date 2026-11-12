# Filtro de escolas no Início para o perfil Direção

## Objetivo

O perfil Direção (somente leitura, todas as escolas) passa a ver e usar o filtro de escolas na tela Início, igual ao Administrador.

## Estado atual

Em `src/routes/_authenticated/dashboard.tsx`, o seletor "Filtrar escolas" só é exibido quando `perms.isAdmin` (linha 381). A função `getDashboardStats` já aceita `schoolIds` e não bloqueia por perfil — as permissões de leitura da Direção (liberadas no banco) já trazem todas as escolas. Ou seja: só falta exibir o seletor.

## Mudança

1. `src/routes/_authenticated/dashboard.tsx`
   - Condição do seletor passa de `perms?.isAdmin` para `perms?.isAdmin || perms?.isDirecao`.
   - Nenhuma outra alteração: a lista de escolas vem de `listSchools` (leitura liberada) e o filtro múltiplo ("Todas as escolas", 1 escola, N escolas) funciona como já funciona para o Administrador.

## Validação

- prettier, tsgo, eslint, git diff --check.
- Confirmar com o usuário: logado como Direção, o seletor aparece no canto superior direito do Início e filtra os indicadores.

## Fora de escopo

- Nenhuma mudança no banco de dados.
- Nenhuma mudança nas demais telas ou permissões da Direção.
