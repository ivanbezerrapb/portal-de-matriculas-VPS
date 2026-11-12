# Apresentação: quem atendeu e quem apresentou

## O que muda

1. **Cadastros vira um grupo com dois itens** — "Lista de cadastros" (a tela atual, sem mudança de endereço) e "Apresentação". Na tela Apresentação ficam os nomes das pessoas, separados por unidade e por tipo:
   - **Secretaria** — quem atendeu o responsável primeiro.
   - **Coordenação** — quem apresentou a escola.
   Uma unidade nunca vê os nomes de outra. O Gerente cadastra na sua unidade; o Administrador escolhe a unidade.
2. **Duas colunas novas na listagem de cadastros** — "Atendimento" e "Apresentação", antes de Matrícula. A Gerente digita e a lista se autocompleta com os nomes já cadastrados daquela unidade e daquele tipo. Se o nome ainda não existir, aparece a opção "Cadastrar «nome»", que salva e já vincula ao cadastro.
3. **Dois indicadores na tela Início** — "Quem mais atendeu (Secretaria)" e "Quem mais apresentou (Coordenação)", em barras, com a quantidade de cadastros por pessoa, respeitando o filtro de escolas e o ano de campanha (ago→jul).

Quem pode informar ou alterar: Administrador e Gerente. Secretaria e Central de Informações apenas visualizam.

## Detalhes

- Campos opcionais: cadastro sem nome mostra "—" e não entra nos indicadores.
- Nomes repetidos na mesma unidade e mesmo tipo são evitados (sem diferenciar maiúsculas/acentos).
- Na tela Apresentação dá para renomear e desativar. Desativado some da escolha, mas os cadastros já vinculados continuam mostrando o nome.

## Técnico

Banco (migração na base externa, via psql com `/tmp/dburl`):
- `public.presenters` (`id uuid pk default gen_random_uuid()`, `school_id uuid not null references public.schools on delete cascade`, `kind text not null check (kind in ('secretaria','coordenacao'))`, `name text not null`, `active boolean not null default true`, `created_at timestamptz default now()`), índice único em `(school_id, kind, lower(btrim(name)))`.
- GRANTs: `select, insert, update, delete` para `authenticated`; `all` para `service_role`. RLS habilitada.
- Policies: SELECT para admin ou escolas em `public.user_crm_school_ids(auth.uid())`; INSERT/UPDATE/DELETE para admin ou `school_manager` da escola.
- `submissions.attendant_id` e `submissions.presenter_id` — ambos `uuid references public.presenters on delete set null`, nullable (aditivo).

Servidor:
- Novo `src/lib/ext/apresentacao.functions.ts`: `listPresenters({ school_id?, kind? })`, `createPresenter({ school_id, kind, name })`, `updatePresenter({ id, name?, active? })`, `deletePresenter({ id })` — `requireAuth` + checagem via `getPerms` (admin ou gerente da escola).
- `cadastros.functions.ts`: `listSubmissions` traz `attendant_id`, `presenter_id` e os nomes via joins nomeados (`attendant:presenters!submissions_attendant_id_fkey(name)` e `presenter:presenters!submissions_presenter_id_fkey(name)`); novo `setSubmissionPeople({ submission_id, kind, presenter_id | new_name })` que valida permissão (admin ou gerente da escola do cadastro), cria o nome quando vier `new_name` e grava em `audit_log`.
- `getDashboardStats`: novas saídas `attendants` e `presenters` (`{ label, count }[]`, ordenadas decrescente), contando cadastros do período e das escolas filtradas agrupados por cada coluna; sem nome não entra.

Front:
- Nova rota `src/routes/_authenticated/apresentacao.tsx` com `head()` próprio; seletor de unidade (fixo para o Gerente), duas listas lado a lado (Secretaria e Coordenação) com adicionar/renomear/ativar/desativar.
- `route.tsx`: "Cadastros" vira `NavGroup` com os filhos "Lista de cadastros" (`/cadastros`) e "Apresentação" (`/apresentacao`); `allowedPaths` libera `/apresentacao` para admin e gerente.
- `cadastros.tsx`: colunas "Atendimento" e "Apresentação", cada uma com um combobox por linha (input + lista filtrada dos nomes ativos daquela escola e tipo), opção "Cadastrar «nome»", `useMutation` chamando `setSubmissionPeople` e invalidando `submissions` e `dashboard-stats`; somente leitura sem permissão.
- `dashboard.tsx`: dois cards de barras reutilizando o componente existente, dentro da grade de indicadores.
