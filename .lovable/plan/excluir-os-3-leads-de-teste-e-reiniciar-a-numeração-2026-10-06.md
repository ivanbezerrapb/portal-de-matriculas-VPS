# Excluir os 3 LEADS de teste e reiniciar a numeração

## O que será apagado (somente Lista de LEADS)
- 1001/CE2027 — IVAN BEZERRA (Centro)
- 2001/CR2027 — teste ivan cristo (Cristo)
- 4001/EX2027 — IVANILDO BEZERRA (Expedicionários)

Junto com eles saem as respostas do formulário, os cartões do CRM criados a partir deles, as tarefas, o histórico de anotações e o registro de check-in.

## O que não muda
A Lista de Visitantes, os formulários, os funis, os usuários e a numeração dos visitantes ficam como estão.

## Numeração dos LEADS
O próximo LEAD de cada unidade volta a ser:
- Centro: 1001/CE2027
- Cristo: 2001/CR2027
- Bessa: 3001/BE2027
- Expedicionários: 4001/EX2027

Apagar esses cadastros não tem volta.

## Detalhes técnicos
- No banco externo: localizar `submissions` com `list_type='leads'` e `public_id` nos 3 valores; apagar na ordem `crm_notes` → `crm_tasks` → `opportunities` (por submission_id) → `submission_values` → `audit_log` (entity dos cadastros) → `submissions`.
- `UPDATE schools SET lead_next_number` = 1001 (Centro), 2001 (Cristo), 3001 (Bessa), 4001 (Expedicionários).
- Depois conferir que a Lista de LEADS ficou vazia e que os contadores estão corretos.
