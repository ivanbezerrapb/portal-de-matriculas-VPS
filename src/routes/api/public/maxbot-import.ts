import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Chamado pelo agendador a cada 10 minutos: importa LEADS das contas Maxbot com importação ativa.
export const Route = createFileRoute("/api/public/maxbot-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { extAdmin } = await import("@/lib/ext/server");
        const { readAll, importAccount, ACCOUNTS } = await import("@/lib/ext/maxbot.server");
        const db = extAdmin();
        const all = await readAll(db);
        const results: Record<string, { ok: boolean; imported: number }> = {};
        for (const a of ACCOUNTS) {
          if (!all[a].import_enabled || !all[a].token) continue;
          const r = await importAccount(db, a);
          results[a] = { ok: r.ok, imported: r.imported };
        }
        // Cadastra no Maxbot os cards recentes que ainda não estão lá.
        const { syncRecentOpportunities } = await import("@/lib/ext/maxbot.server");
        let synced = 0;
        try { synced = await syncRecentOpportunities(db); } catch (e) { console.error("maxbot sync", e); }
        return Response.json({ ok: true, results, synced });
      },
    },
  },
});
