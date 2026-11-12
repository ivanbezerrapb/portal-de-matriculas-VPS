# Menu CRM: Pipeline, Funil, Tarefas e Motivos

## O que muda

O grupo **CRM** do menu passa a ter 4 itens, nesta ordem:

```text
CRM
 ├─ Pipeline   (já existe)
 ├─ Funil      (já existe)
 ├─ Tarefas    (novo)
 └─ Motivos    (novo — ganho e perda)
```

## 1. Tarefas (novo)

Afazeres ligados a oportunidades, com data e status.

- **Painel da oportunidade** (o que abre ao clicar no cartão no Pipeline) ganha uma seção **Tarefas**: adicionar tarefa (título + data), marcar como feita, excluir.
- **Nova tela `/crm/tarefas`**: lista todas as tarefas pendentes das oportunidades visíveis para o usuário, ordenadas por data (atrasadas em destaque), com nome da oportunidade, escola e botão para abrir a oportunidade. Permite concluir e filtrar: Pendentes / Feitas / Todas.

## 2. Motivos de ganho e perda (novo)

- **Nova tela `/crm/motivos`** (só admin edita): lista de motivos dividida em **Ganho** e **Perda** (ex.: Ganho — "Perto de casa"; Perda — "Preço"). Adicionar, editar, reordenar, ativar/desativar, excluir.
- **Fechamento da oportunidade**: no painel do cartão, botões **Marcar como ganho** / **Marcar como perdida**. Ao escolher, abre janela pedindo o motivo (lista do tipo correspondente) + observação opcional. A oportunidade sai do quadro e guarda: resultado (ganho/perda), motivo, observação e data.
- No Pipeline, filtro para ver também as oportunidades **Ganhas** / **Perdidas** (cartão mostra o motivo), com opção de **reabrir** (volta para a etapa em que estava).
- A tela de **Funil** não muda.

## Permissões

- Tarefas: admin e gestor/operador da escola (mesma regra das oportunidades).
- Motivos: leitura para quem usa o CRM; criar/editar/excluir só admin.

## Detalhes técnicos

- Banco (via psql):
  - `public.crm_tasks` (id, opportunity_id → opportunities, title, due_date, done, done_at, created_by, created_at) + GRANTs + RLS seguindo a escola da oportunidade.
  - `public.crm_close_reasons` (id, kind `won`|`lost`, label, position, active, created_at — globais, não por escola) + GRANTs + RLS (SELECT para autenticados, escrita admin).
  - `public.opportunities` ganha: `status text default 'open'` (`open`|`won`|`lost`), `close_reason_id`, `close_note`, `closed_at`.
- `src/lib/ext/model.ts`: tipos `CrmTask`, `CloseReason`; `Opportunity` ganha os campos de fechamento.
- `src/lib/ext/tarefas.functions.ts` (novo): listar/criar/concluir/excluir tarefas.
- `src/lib/ext/motivos.functions.ts` (novo): CRUD de motivos (admin) + listar ativos.
- `src/lib/ext/pipeline.functions.ts`: `closeOpportunity`, `reopenOpportunity`; `listPipeline` filtra por status.
- `src/routes/_authenticated/crm.tarefas.tsx` e `crm.motivos.tsx` (novas telas, com head() próprios).
- `src/routes/_authenticated/route.tsx`: dois itens novos no grupo CRM.
- `src/routes/_authenticated/crm.pipeline.tsx`: seção Tarefas no painel, botões de fechamento, filtro de status.
- Validação: prettier, tsgo, eslint, `git diff --check`.
