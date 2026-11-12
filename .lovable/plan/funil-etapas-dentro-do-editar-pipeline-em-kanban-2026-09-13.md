# Funil: etapas dentro do editar + Pipeline em Kanban

## CRM › Funil (listagem simples)

- A página passa a mostrar apenas a lista de funis criados: nome, escola, descrição e a quantidade de etapas.
- Uma linha discreta com as bolinhas coloridas das etapas dá uma prévia da sequência, sem permitir editar ali.
- Ações por funil continuam: **Editar**, **Duplicar** e **Excluir** (só para administrador).
- Ao clicar em **Editar**, abre a tela do funil com duas partes:
  - Dados do funil: nome, escola e descrição.
  - Etapas: adicionar, renomear, mudar cor e descrição, subir/descer e excluir — exatamente o que existe hoje, só que agora dentro do editar.
- Botão "Voltar" retorna à listagem.

## CRM › Pipeline (Kanban)

- No topo, um seletor "Funil" lista os funis disponíveis (o administrador vê todos; gestor e operador veem só os da sua escola). A escolha fica guardada no endereço da página, então dá para compartilhar o link.
- Escolhido o funil, aparece um quadro com uma coluna por etapa, na ordem definida, com a cor da etapa no topo e a contagem de oportunidades.
- Cada cartão mostra o nome da pessoa, telefone (se houver), a etiqueta da etapa atual e a data de entrada. Cartões vindos de cadastros trazem o código do cadastro e abrem o cadastro ao clicar.
- Arrastar e soltar move o cartão entre colunas e salva na hora; se falhar, o cartão volta e aparece um aviso.
- Botão "Nova oportunidade" cria um cartão manual (nome, telefone, e-mail, observação, etapa inicial).
- Cadastros recebidos entram automaticamente na primeira etapa do funil da escola; se a escola tiver mais de um funil, o cadastro entra no funil marcado como padrão da escola.
- Cada funil ganha a marcação "funil padrão da escola" no editar; o primeiro funil criado para a escola já nasce como padrão.
- Sem funil selecionado ou sem etapas, aparece uma mensagem orientando a criar/escolher um funil.

## Detalhes técnicos

**Banco (psql no banco externo, padrão do projeto)**

- `public.funnels`: adicionar `is_default boolean not null default false`; índice único parcial por `school_id` onde `is_default`.
- `public.opportunities`: `id uuid pk`, `funnel_id uuid not null references funnels(id) on delete cascade`, `stage_id uuid not null references funnel_stages(id) on delete cascade`, `school_id uuid not null references schools(id) on delete cascade`, `submission_id uuid references submissions(id) on delete set null` (único quando não nulo), `name text not null`, `phone text`, `email text`, `notes text`, `position int not null default 0`, `created_at/updated_at timestamptz default now()`; índice `(stage_id, position)`.
- GRANTs: `select, insert, update, delete` para `authenticated`, `all` para `service_role`, sem `anon`.
- RLS: SELECT para admin ou quando `school_id` está entre as escolas do usuário; INSERT/UPDATE/DELETE para admin ou gestor da escola.
- Gatilho `after insert on submissions`: cria a oportunidade na primeira etapa do funil padrão da escola, usando o nome do responsável quando disponível; nada acontece se a escola não tiver funil.

**Server functions** — `src/lib/ext/funis.functions.ts` ganha `is_default` em create/update. Novo `src/lib/ext/pipeline.functions.ts` com `requireAuth` e Zod: `listPipeline({ funnel_id })` (etapas + oportunidades), `createOpportunity`, `updateOpportunity`, `moveOpportunity({ id, stage_id, position })` com reordenação, `deleteOpportunity`.

**Tipos** — `Opportunity` em `src/lib/ext/model.ts`; `is_default` em `Funnel`.

**Telas**
- `src/routes/_authenticated/crm.funil.tsx`: passa a ser só listagem, com estado local para o funil em edição (painel de edição com dados + etapas reaproveitando o `StageForm` atual).
- `src/routes/_authenticated/crm.pipeline.tsx`: reescrita com TanStack Query, `validateSearch` para `funnel`, colunas por etapa e arrastar-e-soltar usando os eventos nativos de HTML5 (sem nova dependência), com atualização otimista e invalidação da query.
