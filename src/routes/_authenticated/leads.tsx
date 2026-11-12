import { createFileRoute } from "@tanstack/react-router";
import { SubmissionsList } from "@/components/SubmissionsList";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Lista de LEADS — Grupo Inter" },
      { name: "description", content: "Consulte e gerencie os leads cadastrados." },
      { property: "og:title", content: "Lista de LEADS — Grupo Inter" },
      { property: "og:description", content: "Consulte e gerencie os leads cadastrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SubmissionsList listType="leads" title="Lista de LEADS" />,
});
