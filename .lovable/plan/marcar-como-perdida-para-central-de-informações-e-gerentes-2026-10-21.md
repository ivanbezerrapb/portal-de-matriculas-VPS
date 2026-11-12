# Marcar como perdida para Central de Informações e Gerentes

## O que muda
- No painel do cartão do Pipeline, o botão **Marcar como perdida** passa a aparecer também para:
  - **Central de Informações**: nos cartões dos funis aos quais está vinculada, em todas as escolas.
  - **Gerentes**: nos cartões dos funis da própria unidade.
- **Marcar como ganha** continua só para Administrador (o ganho vem do check-in / Matriculado das secretarias).
- Reabrir oportunidade continua só para Administrador.
- Direção continua somente leitura.

## Etapa ao perder
- Ao confirmar a perda (motivo + observação, como hoje), o cartão é movido para a etapa **Perdido** do funil.
- Funis Pós Visita: usam a etapa Perdido já existente.
- Funis LEADS (todas as unidades): criar a etapa **Perdido** no fim do funil.
- A perda também conclui as tarefas pendentes e registra no Histórico (motivo, autor, data/hora).
- Cartões perdidos somem da visão "Em aberto" (aparecem em "Perdidas").

## Detalhes técnicos
- `crm.pipeline.tsx`: separar `canWin` (admin) de `canLose` (admin, gerente da escola do funil, central vinculada ao funil).
- `closeOpportunity`: validar a permissão no servidor para `lost` (admin / gerente da unidade / central vinculada via `user_funnels`); para `won` manter admin/fluxos existentes. Se o usuário não puder atualizar pela RLS, executar a atualização com o cliente admin após validar.
- Localizar etapa cujo nome normalizado seja "perdido"/"perdida" no funil e gravar `stage_id`; se não existir, erro claro.
- Inserir etapa "Perdido" (última posição) nos funis LEADS que não a têm.
- Concluir `crm_tasks` abertas e inserir nota em `crm_notes`.
