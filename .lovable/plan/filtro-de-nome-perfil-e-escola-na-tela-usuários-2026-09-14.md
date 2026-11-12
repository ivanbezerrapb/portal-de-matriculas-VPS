# Filtro de Nome, Perfil e Escola na tela Usuários

## O que muda

Na tela **Usuários** (visível apenas para Administrador), acima da lista de usuários, entra uma barra de filtros com três campos lado a lado:

1. **Nome** — campo de texto livre que filtra pelo nome completo ou pelo e-mail, ignorando acentos e maiúsculas/minúsculas, enquanto o administrador digita.
2. **Perfil** — lista suspensa com as opções: Todos os perfis, Administrador, Gerente, Secretaria, Central de Informações.
3. **Escola** — lista suspensa carregada da mesma lista de escolas que já existe na tela, com a opção "Todas as escolas".

## Como funciona

- A filtragem é feita na listagem já carregada (sem novas consultas ao servidor): o usuário aparece quando atende aos três filtros ao mesmo tempo.
- **Nome**: bate se o texto digitado aparece no nome completo OU no e-mail do usuário.
- **Perfil**: bate se qualquer um dos perfis atribuídos ao usuário for o perfil escolhido (usuários com mais de um perfil aparecem em qualquer um deles).
- **Escola**: bate se qualquer perfil atribuído ao usuário estiver vinculado à escola escolhida.
- Quando nenhum usuário atende aos filtros, aparece a mensagem "Nenhum usuário encontrado" no lugar da lista, com a mesma aparência dos demais estados vazios do sistema.
- Abaixo dos filtros a lista continua exatamente como hoje (cartões com nome, e-mail, perfis atribuídos, botões "+ Perfil" e "Excluir"). Nada muda na criação ou edição de usuários.

## Detalhes técnicos

- Arquivo único: `src/routes/_authenticated/usuarios.tsx`.
- Novo estado local: `filterName` (string), `filterRole` (Role | "all"), `filterSchool` (string).
- A lista filtrada é derivada com `useMemo` a partir de `users`, `filterName`, `filterRole` e `filterSchool`; normalização com `.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")`.
- Campo Perfil reaproveita `ROLE_LABELS` de `@/lib/ext/model`; campo Escola reaproveita a query `schools` que já existe na tela.
- Layout: `grid gap-3 sm:grid-cols-3` dentro de um Card acima da listagem; sem alterações no banco, nas funções de servidor ou em outras telas.
