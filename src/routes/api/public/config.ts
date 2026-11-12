import { createFileRoute } from "@tanstack/react-router";

// Config pública do Supabase externo (URL + chave publishable, seguras para o navegador).
// Rota HTTP simples (não é serverFn) para não disparar o middleware de autenticação —
// evita recursão: o middleware precisa do cliente, que precisa desta config.
export const Route = createFileRoute("/api/public/config")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["EXT_SUPABASE_URL"];
        const publishableKey = process.env["EXT_SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !publishableKey) {
          return Response.json(
            { error: "Supabase externo não configurado." },
            { status: 500 },
          );
        }
        return Response.json({ url, publishableKey });
      },
    },
  },
});
