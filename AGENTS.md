<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Maxbot
- Maxbot settings (per account: conecta/interactivo, tokens, label mapping, imported contact ids) live in the private `integracoes/maxbot.json` storage object on the external DB, read only server-side via `src/lib/ext/maxbot.server.ts` — the external DB has no migration path from here, and tokens must never reach the browser.
- Automatic lead import runs from the managed schedule `maxbot-import-leads` (every 10 min) calling `/api/public/maxbot-import`, authenticated with `authenticateCronRequest`.
- Card↔Maxbot contact links live in the `contacts` map (opportunityId→contactId) of `integracoes/maxbot.json`; cards are registered when opened and by the 10-min cron sweep (no hook in each creation path, since cards are created from many places).
