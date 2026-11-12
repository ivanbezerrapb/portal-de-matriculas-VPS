# Esconder filtro de Escola para Gerente e Secretaria na Lista de cadastros

## Contexto
- Tela: `/cadastros` (`src/routes/_authenticated/cadastros.tsx`), barra de filtros com Buscar por ID, Escola, Formulário e datas.
- A listagem já vem limitada às escolas do usuário no servidor (`listSubmissions`); para Gerente e Secretaria, que só acessam uma escola, o seletor de Escola é inútil e pode confundir.

## Mudança
- No arquivo `src/routes/_authenticated/cadastros.tsx`:
  - Renderizar o campo **Escola** (`id="f-school"`) apenas quando `perms?.isAdmin` for verdadeiro — ou seja, só o Administrador continua vendo o filtro.
  - Gerente e Secretaria (e qualquer outro perfil não-admin que acesse a tela) não veem mais esse seletor; a lista continua mostrando somente os cadastros da própria escola.
  - Ajustar o grid da barra de filtros (`lg:grid-cols-5`) para se recompor quando o campo some (ex.: `lg:grid-cols-4` quando não-admin), evitando buraco no layout.
  - Nenhuma mudança no banco, nas funções de servidor ou nas outras telas (o filtro de Escola em Usuários fica como está — lá só o Administrador acessa).

## Validação
- `bunx prettier --write`, `bunx tsgo --noEmit`, `bunx eslint`, `git diff --check`.
