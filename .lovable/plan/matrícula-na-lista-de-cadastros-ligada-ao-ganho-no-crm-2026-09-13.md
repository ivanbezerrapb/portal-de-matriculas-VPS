# Matrícula na lista de cadastros ligada ao ganho no CRM

## O que muda

Nova coluna **Matrícula** na lista de cadastros, com uma caixinha de marcar (sim/não) em cada linha.

Duas formas de dar ganho, sempre sincronizadas:

1. **Pelo CRM** — ao marcar a oportunidade como ganha, o cadastro correspondente passa automaticamente a "Matrícula realizada" (status Ativo).
2. **Pela tela de cadastros** — ao marcar a caixinha de Matrícula:
   - todas as atividades pendentes daquela oportunidade são concluídas;
   - a oportunidade é fechada como **ganha** e sai do quadro de abertas do CRM.

Ao desmarcar a caixinha, a oportunidade volta a ficar aberta (é reaberta no funil, na etapa em que estava) e o cadastro deixa de constar como matriculado. As atividades já concluídas continuam concluídas.

Se um cadastro não tiver oportunidade no CRM, a marcação funciona mesmo assim: só registra a matrícula.

Quem pode marcar: administrador, editor e gestor da escola do cadastro — as mesmas pessoas que já podem editar o cadastro.

## Motivo do ganho

Fechar como ganha exige um motivo. Quando o ganho vem pela tela de cadastros, o sistema usa (ou cria, se não existir) o motivo de ganho **"Matrícula realizada"**, que aparecerá normalmente na tela CRM › Motivos.

## Técnico

Banco (migração aditiva):

- `submissions`: novas colunas `enrolled boolean not null default false`, `enrolled_at timestamptz`, `enrolled_by uuid`.
- Backfill: `enrolled = true` para cadastros cuja oportunidade já está com `status = 'won'`.
- Inserir o motivo de ganho `Matrícula realizada` em `crm_close_reasons` (kind `won`) se ainda não existir.

Servidor:

- `src/lib/ext/cadastros.functions.ts`:
  - `listSubmissions` passa a devolver `enrolled` (já vem no `select("*")`).
  - nova `setEnrollment({ id, enrolled })` com `requireAuth`: valida permissão como em `updateSubmission`; atualiza `enrolled/enrolled_at/enrolled_by`; busca a oportunidade por `submission_id`; se marcado, faz `update crm_tasks set done = true, done_at = now() where opportunity_id = ... and done = false` e fecha a oportunidade (`status='won'`, `close_reason_id` do motivo "Matrícula realizada", `closed_at = now()`); se desmarcado, reabre (`status='open'`, limpa `close_reason_id`, `close_note`, `closed_at`). Registra em `audit_log` a mudança.
- `src/lib/ext/pipeline.functions.ts`:
  - `closeOpportunity`: quando `result = 'won'` e a oportunidade tem `submission_id`, marca `enrolled = true` no cadastro; quando `lost`, marca `enrolled = false`.
  - `reopenOpportunity`: marca `enrolled = false` no cadastro ligado.

Interface:

- `src/routes/_authenticated/cadastros.tsx`: nova coluna "Matrícula" com `input type="checkbox"` por linha (desabilitado enquanto salva, sem permissão fica só leitura), `useMutation` chamando `setEnrollment` e invalidando as queries `submissions` e `pipeline`; toast de confirmação/erro.
