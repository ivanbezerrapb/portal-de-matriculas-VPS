# Funis e etapas (CRM)

Transformar a página **CRM > Funil** (hoje "Em breve") em uma área onde o administrador cria vários funis, cada um vinculado a uma escola, e define as etapas de cada funil.

## Como vai funcionar

**Lista de funis**
- Botão "Novo funil": nome, escola e descrição opcional.
- Cada funil aparece em um cartão com o nome, a escola, o número de etapas e três ícones: **Duplicar**, **Editar** e **Excluir**.
  - Duplicar cria uma cópia com o nome "(cópia)" e todas as etapas iguais.
  - Excluir pede confirmação e remove o funil com suas etapas.
- Quem não é administrador vê a lista, mas sem os botões de criar, duplicar, editar e excluir.
- Gestor e operador de escola veem apenas os funis da própria escola.

**Etapas dentro do funil**
- Ao abrir um funil, aparece a lista de etapas na ordem definida.
- Cada etapa tem: nome, cor, descrição e posição.
- Ações por etapa: editar, subir/descer na ordem e excluir (com confirmação).
- Botão "Nova etapa" adiciona ao final, com uma cor padrão sugerida.
- Ao criar um funil novo, ele já vem com etapas iniciais sugeridas (Novo contato, Em atendimento, Visita agendada, Matriculado, Perdido), que podem ser renomeadas ou removidas.

**Visual**
- Mesmo padrão das telas de Escolas e Templates: cartões, botões e caixas de diálogo já existentes, sem cores fora do tema. A cor da etapa aparece como uma bolinha ao lado do nome.

## Detalhes técnicos

**Banco (aplicado por psql no banco externo, seguindo o padrão do projeto)**

- `public.funnels`: `id uuid pk default gen_random_uuid()`, `school_id uuid not null references schools(id) on delete cascade`, `name text not null`, `description text`, `created_at timestamptz default now()`.
- `public.funnel_stages`: `id uuid pk`, `funnel_id uuid not null references funnels(id) on delete cascade`, `name text not null`, `description text`, `color text not null default '#1e40af'`, `position int not null default 0`, `created_at timestamptz default now()`; índice em `(funnel_id, position)`.
- GRANTs: `select, insert, update, delete` para `authenticated`; `all` para `service_role`; sem acesso `anon`.
- RLS habilitada nas duas tabelas:
  - SELECT: admin vê tudo; demais veem quando `school_id` está entre as escolas do usuário em `user_roles` (mesma lógica já usada nas outras tabelas). Em `funnel_stages`, via `EXISTS` no funil pai.
  - INSERT/UPDATE/DELETE: apenas admin (reaproveitando o helper de papel já existente no banco).

**Server functions** — novo arquivo `src/lib/ext/funis.functions.ts` com `requireAuth`, no mesmo formato de `escolas.functions.ts`:
`listFunnels` (funis + etapas), `createFunnel` (cria com etapas padrão), `updateFunnel`, `duplicateFunnel`, `deleteFunnel`, `createStage`, `updateStage`, `reorderStages`, `deleteStage`. Todas validadas com Zod e com verificação de admin nas escritas.

**Tipos** — `Funnel` e `FunnelStage` em `src/lib/ext/model.ts`.

**Tela** — reescrever `src/routes/_authenticated/crm.funil.tsx` usando TanStack Query (`useQuery` + `useMutation` com invalidação), componentes de `@/components/ui` e `toast` do sonner, mantendo o `head()` atual com texto atualizado.

**Menu** — remover o rótulo "Em breve" do item Funil em `src/routes/_authenticated/route.tsx`; Pipeline continua como está.
