# Adicionar a etiqueta da unidade no contato do Maxbot

## O que muda
Sempre que o portal vincula ou atualiza um contato do Maxbot a partir de um card (ao abrir o card e na rotina de 10 em 10 minutos), ele confere se o contato já tem a etiqueta configurada para a unidade daquele funil em Configurações › MAXBOT. Se não tiver, acrescenta a etiqueta. As outras etiquetas do contato continuam como estão.

- Vale para contatos já vinculados e para os novos.
- Se o card mudar de unidade, a etiqueta da nova unidade também é acrescentada (a antiga não é removida).
- Unidade sem etiqueta configurada: nada é feito.
- Cada acréscimo fica registrado no Log de Registro.

## Detalhes técnicos
- `maxbot.server.ts`: nova `ensureContactSegmentation(db, account, contactId, schoolId)`:
  - título vem de `s.segmentations[schoolId]`; ID numérico via `get_segmentation` (cache por execução, comparação sem acento/maiúsculas).
  - guarda mapa `tagged` (contactId → lista de schoolIds já etiquetados) no `maxbot.json` para não repetir chamadas; não usa `get_contact` com contact_id (a API ignora o filtro).
  - chama `add_contact_segmentation` com `contact_id` e `segmentation_ids`.
- Chamada dentro de `ensureOpportunityContact` logo após `ensureContactName`, em try/catch para não bloquear o vínculo.
- Teste rápido com o card do Ivanildo (contato 8644505) depois de aplicar.
