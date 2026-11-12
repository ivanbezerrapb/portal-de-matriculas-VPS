## v2 (este repositório)
- Este repositório NÃO está ligado ao Lovable. Ele é a evolução do `portal-de-matriculas` (produção). Fases, migrações e variáveis estão em `docs/V2.md`.
- Migrações do banco ficam em `supabase/v2/NNN_*.sql`: aditivas e idempotentes, aplicadas à mão no SQL Editor, em ordem.
- Funis e etapas têm tipo fixo (`funnels.kind`, `funnel_stages.kind`). Use `funnelListType()` e `findStageByKind()` de `src/lib/ext/model.ts`; nunca procure etapa pelo nome.
- WhatsApp: todo acesso ao provedor passa por `src/lib/whatsapp` (interface `WhatsAppProvider`). Tokens e segredos ficam em `whatsapp_instance_secrets` (sem RLS de leitura) e só são lidos com a service role.

## Maxbot
- Maxbot settings (per account: conecta/interactivo, tokens, label mapping, imported contact ids) live in the private `integracoes/maxbot.json` storage object on the external DB, read only server-side via `src/lib/ext/maxbot.server.ts` — the external DB has no migration path from here, and tokens must never reach the browser.
- Automatic lead import runs from the managed schedule `maxbot-import-leads` (every 10 min) calling `/api/public/maxbot-import`, authenticated with `authenticateCronRequest`.
- Card↔Maxbot contact links live in the `contacts` map (opportunityId→contactId) of `integracoes/maxbot.json`; cards are registered when opened and by the 10-min cron sweep (no hook in each creation path, since cards are created from many places).
