import { createFileRoute } from "@tanstack/react-router";
import { CentralArquivos } from "@/components/CentralArquivos";

export const Route = createFileRoute("/_authenticated/arquivos/conecta")({
  head: () => ({
    meta: [
      { title: "Central de Arquivos · Conecta" },
      {
        name: "description",
        content: "Arquivos compartilhados das unidades Centro e Expedicionários.",
      },
      { property: "og:title", content: "Central de Arquivos · Conecta" },
      {
        property: "og:description",
        content: "Arquivos compartilhados das unidades Centro e Expedicionários.",
      },
    ],
  }),
  component: () => <CentralArquivos brand="conecta" />,
});
