import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSupabase } from "@/lib/ext/browser";

// Entrada do app: sem landing page — manda para o painel se logado,
// senão para a tela de login.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal de formulários — Grupo Inter" },
      { name: "description", content: "Acesse o portal de formulários escolares do Grupo Inter." },
      { property: "og:title", content: "Portal de formulários — Grupo Inter" },
      {
        property: "og:description",
        content: "Acesse o portal de formulários escolares do Grupo Inter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
