# "Quem mais atendeu (Coordenação)": mostrar quem já iniciou o atendimento

## O que muda no Início
Cada nome do gráfico passa a ter **duas barras**:
- **Vinculados**: total de cadastros ligados ao funil daquela coordenação (a barra que já existe hoje).
- **Iniciados**: quantos desses cartões já foram movidos pelo menos uma vez para a 2ª etapa ou além.

Uma legenda no topo do card indica as duas cores. Os valores aparecem ao lado de cada barra, como já acontece hoje. Assim fica fácil ver quem tem cartões parados na 1ª etapa.

## Quando um cartão conta como "Iniciado"
Um cartão conta como iniciado quando a coordenação já tirou ele da 1ª etapa pelo menos uma vez. Ou seja, quando ele:
- está hoje na 2ª etapa ou em uma etapa depois dela; ou
- já foi ganho ou perdido; ou
- já passou pela confirmação de responsável, que acontece no primeiro arraste. Assim, um cartão que voltou para a 1ª etapa continua contando.

Os filtros que já existem (ano letivo e escola) continuam valendo.

## Detalhes técnicos
- Em `cadastros.functions.ts`, nos dados do painel: para cada cadastro com atendente, pegar a oportunidade ligada a ele (`submission_id`) com `stage_id`, `status` e `owner_confirmed_at`. Comparar `stage_id` com a etapa de menor posição do funil para calcular `started`. `attendantsBySchool` passa a devolver `{ name, value, started }`.
- Em `dashboard.tsx`: o gráfico daquele card ganha uma segunda barra, `started`, com outra cor e legenda.
