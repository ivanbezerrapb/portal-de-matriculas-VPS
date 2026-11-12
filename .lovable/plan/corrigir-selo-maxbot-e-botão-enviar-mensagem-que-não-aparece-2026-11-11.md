# Corrigir selo Maxbot e botão Enviar mensagem que não aparecem

## Causa
O telefone mostrado em "Dados do cliente" vem da ficha (formulário) do lead. O campo telefone do próprio card está vazio nesses casos (ex.: leads importados do Maxbot / Lista de LEADS). O selo e o botão só aparecem quando o telefone do card está preenchido, e o servidor também só procura esse campo — por isso nada aparece.

## O que muda
- O portal passa a usar o telefone da ficha quando o card não tiver telefone próprio (servidor e tela).
- O selo verde **Maxbot** aparece ao lado do telefone dentro de "Dados do cliente" (onde o telefone é exibido na janela grande).
- O botão **Enviar mensagem** aparece abaixo de "Ver ficha completa" sempre que houver telefone no card ou na ficha.
- A rotina de 10 minutos também usa o telefone da ficha ao cadastrar contatos no Maxbot.

## Detalhes técnicos
- `maxbot.functions.ts` `loadOpp` e `maxbot.server.ts` (`ensureOpportunityContact`, `syncRecentOpportunities`): se `opportunities.phone` for nulo, buscar o campo Telefone em `submission_values` do `submission_id`.
- `crm.pipeline.tsx`: renderizar `MaxbotSend` quando `card.phone || card.submission_id`; passar `opportunityId` para `OpportunityCustomer` exibir `MaxbotBadge` ao lado do campo Telefone (e não duplicar quando o telefone do card já mostra o selo).
- Verificar no navegador com o card "Ivanildo Farias".
