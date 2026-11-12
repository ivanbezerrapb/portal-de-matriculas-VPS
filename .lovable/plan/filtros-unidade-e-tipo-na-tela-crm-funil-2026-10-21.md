# Filtros Unidade e Tipo na tela CRM › Funil

## O que muda
- Acima da lista de funis, dois filtros lado a lado:
  - **Unidade:** Todas / Centro / Cristo / Bessa / Expedicionários (só as unidades que a pessoa pode ver).
  - **Tipo:** Todos / LEADS / Visitantes (Pós Visita).
- Os filtros combinam entre si; um contador mostra "X funis" e há um botão **Limpar filtros**.
- Sem resultado: mensagem "Nenhum funil para este filtro".
- Nada muda nos funis, etapas ou permissões.

## Técnico
- `src/routes/_authenticated/crm.funil.tsx`: estados `schoolId` e `kind`; filtra no cliente a lista já carregada por `school_id` e por `funnelListType(name)` (nome com "lead" = LEADS, demais = Visitantes, mesma regra já usada nas listas).
