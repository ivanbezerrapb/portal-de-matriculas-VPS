import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PrintSheets, type PrintSheetsState } from "@/components/print/PrintSheets";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/imprimir/$templateId")({
  head: () => ({
    meta: [
      { title: "Imprimir cadastro — Grupo Inter" },
      { name: "description", content: "Visualize e imprima fichas de cadastro." },
      { property: "og:title", content: "Imprimir cadastro — Grupo Inter" },
      { property: "og:description", content: "Visualize e imprima fichas de cadastro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ids: z.string().default("").parse(search["ids"]),
  }),
  component: PrintPage,
});

function PrintPage() {
  const { templateId } = Route.useParams();
  const { ids } = Route.useSearch();
  const [state, setState] = useState<PrintSheetsState>({ status: "loading" });

  const submissionIds = ids.split(",").filter(Boolean);

  return (
    <div className="mx-auto w-fit">
      <div className="no-print mb-4 flex items-center justify-between gap-6">
        <Link to="/cadastros" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <Button
          onClick={() => window.print()}
          disabled={state.status !== "ready" || !state.canPrint}
        >
          Imprimir{" "}
          {state.status === "ready" ? `${state.count} ficha${state.count > 1 ? "s" : ""}` : ""}
        </Button>
      </div>

      {state.status === "ready" && state.overflow && (
        <div className="no-print mb-4 max-w-2xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Esta ficha possui conteúdo fora do limite da folha. Ajuste o modelo antes de imprimir para
          evitar dados cortados.
        </div>
      )}

      {state.status === "error" && (
        <p className="no-print mb-4 text-sm text-destructive">{state.message}</p>
      )}

      <PrintSheets templateId={templateId} submissionIds={submissionIds} onStateChange={setState} />
    </div>
  );
}
