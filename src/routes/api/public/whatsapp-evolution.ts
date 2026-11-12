import { createFileRoute } from "@tanstack/react-router";

// Webhook da Evolution API: recebe conexão, QR Code, mensagens e status.
// Autenticação: segredo da instância, enviado no cabeçalho e na URL (configurados ao criar a instância).
export const Route = createFileRoute("/api/public/whatsapp-evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { WEBHOOK_SECRET_HEADER } = await import("@/lib/whatsapp/evolution.server");
        const { parseEvolutionWebhook } = await import("@/lib/whatsapp/evolution-events");
        const { ingestEvents } = await import("@/lib/whatsapp/ingest.server");
        const { extAdmin } = await import("@/lib/ext/server");

        // Segredo no cabeçalho (preferido) ou no parâmetro ?s= da URL, para versões da
        // Evolution que não enviam cabeçalhos personalizados.
        const provided =
          request.headers.get(WEBHOOK_SECRET_HEADER) ?? new URL(request.url).searchParams.get("s") ?? "";
        if (!provided) return new Response("Unauthorized", { status: 401 });

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }
        const instanceName =
          payload && typeof payload === "object" ? String((payload as Record<string, unknown>)["instance"] ?? "") : "";
        if (!instanceName) return new Response("Bad Request", { status: 400 });

        const db = extAdmin();
        const { data: inst } = await db
          .from("whatsapp_instances")
          .select("id, whatsapp_instance_secrets(webhook_secret)")
          .eq("external_name", instanceName)
          .eq("provider", "evolution")
          .maybeSingle();
        const row = inst as unknown as {
          id: string;
          whatsapp_instance_secrets: { webhook_secret: string } | { webhook_secret: string }[] | null;
        } | null;
        const sec = Array.isArray(row?.whatsapp_instance_secrets)
          ? row?.whatsapp_instance_secrets[0]
          : row?.whatsapp_instance_secrets;
        if (!row || !sec?.webhook_secret || !(await safeEqual(provided, sec.webhook_secret))) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const events = parseEvolutionWebhook(payload);
          const { applied } = await ingestEvents(db, row.id, events);
          return Response.json({ ok: true, applied });
        } catch (e) {
          console.error("whatsapp-evolution webhook", e);
          // 500 faz a Evolution tentar de novo; o índice único evita duplicar mensagens.
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});

async function safeEqual(a: string, b: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const d = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(d(a), d(b));
}
