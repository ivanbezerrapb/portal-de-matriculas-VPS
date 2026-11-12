# Confirmar o responsável no primeiro arraste do cartão

Vale para todos os pipelines (Visitantes e LEADS).

## Como vai funcionar

1. Quando alguém arrastar um cartão para outra etapa pela primeira vez, o cartão ainda não muda de etapa. Antes disso, abre a janela **"Confirmar responsável"**.
2. Na janela:
   - Aparecem as pessoas vinculadas àquele funil. Se o cartão já tem responsável, ele vem marcado.
   - **Cancelar:** o cartão volta para a etapa onde estava e nada é alterado.
   - **Confirmar e mover:** o responsável é salvo e o cartão vai para a nova etapa.
3. Depois de confirmado, os próximos arrastes daquele cartão acontecem direto, sem a janela.
4. Mover o cartão dentro da mesma etapa (só mudar a ordem) não abre a janela.
5. Perfil Direção continua só leitura e não arrasta cartões.

## Detalhes técnicos

- Nova coluna `opportunities.owner_confirmed_at timestamptz null` no banco externo (cartões já existentes ficam com o valor vazio e pedem a confirmação no primeiro arraste).
- `moveOpportunity` passa a aceitar `owner_id` opcional; quando a etapa muda e `owner_confirmed_at` está vazio, exige `owner_id` (validado com `validateOwner`) e grava `owner_id` + `owner_confirmed_at = now()` antes de mover.
- `listPipeline` já retorna a coluna (select `*`).
- `crm.pipeline.tsx`: no `onDrop`, se `stage_id` mudou e `!card.owner_confirmed_at`, guarda o movimento pendente e abre o diálogo com a lista de `listFunnelOwners`; confirmar chama `moveM` com `owner_id`; cancelar descarta e invalida `["pipeline"]`.
- Atualizar `supabase-setup.sql` com a nova coluna.
