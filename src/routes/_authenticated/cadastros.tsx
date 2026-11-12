import { createFileRoute } from "@tanstack/react-router";
import { SubmissionsList } from "@/components/SubmissionsList";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Lista de Visitantes — Grupo Inter" },
      { name: "description", content: "Consulte e gerencie as visitas escolares." },
      { property: "og:title", content: "Lista de Visitantes — Grupo Inter" },
      { property: "og:description", content: "Consulte e gerencie as visitas escolares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SubmissionsList listType="visitantes" title="Lista de Visitantes" />,
});
