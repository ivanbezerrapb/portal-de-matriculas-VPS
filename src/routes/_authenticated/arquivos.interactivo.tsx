import { createFileRoute } from "@tanstack/react-router";
import { CentralArquivos } from "@/components/CentralArquivos";

export const Route = createFileRoute("/_authenticated/arquivos/interactivo")({
  head: () => ({
    meta: [
      { title: "Central de Arquivos · Interactivo" },
      {
        name: "description",
        content: "Arquivos compartilhados das unidades Cristo e Bessa.",
      },
      { property: "og:title", content: "Central de Arquivos · Interactivo" },
      {
        property: "og:description",
        content: "Arquivos compartilhados das unidades Cristo e Bessa.",
      },
    ],
  }),
  component: () => <CentralArquivos brand="interactivo" />,
});
