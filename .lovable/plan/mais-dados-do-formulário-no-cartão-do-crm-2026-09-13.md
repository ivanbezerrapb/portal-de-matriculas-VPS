# Mais dados do formulário no cartão do CRM

Hoje o cartão guarda apenas nome, telefone e e-mail. A aba **Destino** passa a permitir escolher, em lista livre e em ordem, outros campos do formulário que serão levados junto para o CRM e exibidos ao abrir o cartão.

## Como vai funcionar

1. **Aba Destino › Dados do cartão** ganha uma seção "Informações adicionais":
   - botão "Adicionar informação" cria uma linha com um seletor de campo do formulário;
   - cada linha pode ser reordenada (setas) e removida;
   - o mesmo campo não pode ser escolhido duas vezes;
   - opcionalmente um rótulo próprio (se vazio, usa o nome do campo).
2. **No envio do formulário**, além de nome/telefone/e-mail, as respostas desses campos são copiadas para a oportunidade, no formato "rótulo: resposta", na ordem definida.
3. **No Pipeline**, o cartão continua enxuto (nome, telefone, etapa, data). Ao clicar no cartão abre um painel lateral com:
   - nome, telefone, e-mail;
   - a lista das informações adicionais;
   - etapa atual e data de entrada;
   - botão "Abrir cadastro" quando a oportunidade veio de um formulário.
   O clique que hoje leva direto ao cadastro passa a abrir esse painel.
4. **Cadastros antigos**: o botão "Aplicar aos cadastros existentes" passa a atualizar também as informações adicionais dos cartões já criados (sem duplicar oportunidades).

## Detalhes técnicos

- Banco: nova coluna `form_destinations.extra_fields jsonb default '[]'` com `{field_id, label}`; nova coluna `opportunities.details jsonb default '[]'` com `{label, value}` capturados no momento do envio.
- `src/lib/ext/destino.server.ts`: `applyDestination` monta `details` a partir de `extra_fields` e das respostas; no reprocessamento, quando a oportunidade já existe, faz `update` de `name/phone/email/details` em vez de ignorar.
- `src/lib/ext/destino.functions.ts`: `saveDestination` valida e grava `extra_fields`; `getDestination` devolve o campo.
- `src/routes/_authenticated/formularios_.$formId.tsx` (`DestinationTab`): nova seção de informações adicionais com adicionar/reordenar/remover.
- `src/routes/_authenticated/crm.pipeline.tsx`: estado do cartão selecionado e painel de detalhes lendo `details`; tipo `Opportunity` em `src/lib/ext/model.ts` ganha `details`.
- Valores de múltipla escolha e do campo "N Filhos" são convertidos para texto legível antes de gravar.
