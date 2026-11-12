# Ganho sem matrícula para cartões da Lista de LEADS

## O que muda
- Ao clicar em **Marcar como ganha** num cartão que veio da **Lista de LEADS**, a janela pede só o motivo e a observação — o campo "Matrículas efetivadas" some.
- Para cartões da **Lista de Visitantes** nada muda: continua obrigatório informar a quantidade de matrículas, que é gravada na ficha.
- No cartão de LEADS ganho, a ficha do lead não é marcada como matriculada (o lead não tem matrícula; a lista de LEADS segue mostrando Check-in). O cartão fica como ganho, com motivo, histórico e Log normalmente.

## Detalhes técnicos
- `crm.pipeline.tsx`: `CloseDialog` recebe nova prop `askEnrollment` = `linkedSubmission && list_type !== "leads"`; o campo, a validação do botão e o valor enviado passam a depender dela.
- `pipeline.functions.ts` (`closeOpportunity`): buscar `submissions(list_type)` junto do `submission_id`; só exigir `enrollment_count` e só atualizar `enrolled/enrollment_count/enrolled_at/enrolled_by` (e o `audit_log` correspondente) quando a lista não for `leads`.
- Reabrir/perder cartão de LEADS também não mexe nos campos de matrícula da ficha.
- Teste vitest pequeno para a regra "pede matrícula só para Visitantes".
