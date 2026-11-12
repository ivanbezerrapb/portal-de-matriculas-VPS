import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  appendLegacyRows,
  createLegacyDataset,
  deleteLegacyDataset,
  finalizeLegacyDataset,
  listLegacyDatasets,
  listLegacyRows,
} from "@/lib/ext/legado.functions";
import { Button, Card, EmptyState, Input, Label, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/bancos-anteriores")({
  head: () => ({
    meta: [
      { title: "Bancos anteriores — Grupo Inter" },
      {
        name: "description",
        content: "Importe e consulte planilhas de visitas de anos letivos anteriores.",
      },
      { property: "og:title", content: "Bancos anteriores — Grupo Inter" },
      {
        property: "og:description",
        content: "Importe e consulte planilhas de visitas de anos letivos anteriores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegacyPage,
});

type Cell = string | number | boolean | null;
type ParsedSheet = { columns: string[]; rows: Record<string, Cell>[] };

async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) throw new Error("A planilha não tem nenhuma aba.");
  const sheet = wb.Sheets[first]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });
  const columns: string[] = [];
  const rows = raw.map((row) => {
    const clean: Record<string, Cell> = {};
    for (const [key, value] of Object.entries(row)) {
      const label = key.trim();
      if (!label || label.startsWith("__EMPTY")) continue;
      if (!columns.includes(label)) columns.push(label);
      if (value == null || value === "") clean[label] = null;
      else if (value instanceof Date) clean[label] = value.toISOString();
      else if (typeof value === "number" || typeof value === "boolean") clean[label] = value;
      else clean[label] = String(value);
    }
    return clean;
  });
  return { columns, rows };
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [year, setYear] = useState<number>(currentYear);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFile(f: File | null) {
    setFile(f);
    setParsed(null);
    if (!f) return;
    try {
      setBusy(true);
      const result = await parseSpreadsheet(f);
      setParsed(result);
      if (!name) setName(f.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setProgress(0);
    try {
      const { id } = await createLegacyDataset({
        data: {
          name: name.trim(),
          school_year: year,
          source_filename: file?.name ?? null,
          columns: parsed.columns,
        },
      });
      const chunk = 200;
      for (let i = 0; i < parsed.rows.length; i += chunk) {
        await appendLegacyRows({
          data: { dataset_id: id, start_index: i, rows: parsed.rows.slice(i, i + chunk) },
        });
        setProgress(Math.min(i + chunk, parsed.rows.length));
      }
      await finalizeLegacyDataset({ data: { dataset_id: id, row_count: parsed.rows.length } });
      toast.success("Banco importado.");
      setName("");
      setFile(null);
      setParsed(null);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="font-semibold text-foreground">Importar planilha</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="legacy-file">Arquivo (.xlsx, .xls ou .csv)</Label>
          <Input
            id="legacy-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="legacy-name">Nome do banco</Label>
          <Input
            id="legacy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: BD_VISITAS_2026"
          />
        </div>
        <div>
          <Label htmlFor="legacy-year">Ano letivo</Label>
          <Input
            id="legacy-year"
            type="number"
            min={1990}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
      </div>

      {parsed ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {parsed.rows.length} linhas e {parsed.columns.length} colunas reconhecidas:{" "}
          <span className="text-foreground">{parsed.columns.slice(0, 6).join(", ")}</span>
          {parsed.columns.length > 6 ? "…" : ""}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={handleImport}
          disabled={busy || !parsed || parsed.rows.length === 0 || name.trim().length < 2}
        >
          Importar
        </Button>
        {busy ? <Spinner className="h-4 w-4" /> : null}
        {progress > 0 ? (
          <span className="text-xs text-muted-foreground">
            {progress} de {parsed?.rows.length} linhas enviadas
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function DatasetRows({ datasetId, columns }: { datasetId: string; columns: string[] }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["legacy-rows", datasetId, page, search],
    queryFn: () => listLegacyRows({ data: { dataset_id: datasetId, page, search } }),
  });

  const shown = columns.slice(0, 8);

  return (
    <div className="mt-4">
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        placeholder="Buscar nesta base…"
        className="max-w-sm"
      />
      {isLoading ? (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="Nenhum registro encontrado" description="Ajuste a busca." />
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {shown.map((c) => (
                    <th key={c} className="px-2 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.row_index} className="border-b border-border/60">
                    {shown.map((c) => (
                      <td key={c} className="px-2 py-2 break-words text-foreground">
                        {r.data[c] == null ? "—" : String(r.data[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              {page * data.pageSize + 1}–{Math.min((page + 1) * data.pageSize, data.total)} de{" "}
              {data.total}
            </span>
            <Button
              variant="ghost"
              disabled={(page + 1) * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function LegacyPage() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: datasets, isLoading } = useQuery({
    queryKey: ["legacy-datasets"],
    queryFn: () => listLegacyDatasets(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLegacyDataset({ data: { id } }),
    onSuccess: () => {
      toast.success("Banco excluído.");
      queryClient.invalidateQueries({ queryKey: ["legacy-datasets"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold text-foreground">Bancos anteriores</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Planilhas de anos letivos anteriores, guardadas em separado dos cadastros atuais.
      </p>

      <ImportCard onDone={() => queryClient.invalidateQueries({ queryKey: ["legacy-datasets"] })} />

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !datasets || datasets.length === 0 ? (
        <EmptyState
          title="Nenhum banco importado"
          description="Use o formulário acima para enviar a primeira planilha."
        />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {datasets.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ano letivo {d.school_year} · {d.row_count} registros · {d.columns.length}{" "}
                    colunas
                    {d.source_filename ? ` · ${d.source_filename}` : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                >
                  {openId === d.id ? "Fechar" : "Ver dados"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Excluir o banco "${d.name}" e todos os seus registros?`)) {
                      deleteMut.mutate(d.id);
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
              {openId === d.id ? <DatasetRows datasetId={d.id} columns={d.columns} /> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
