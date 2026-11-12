import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";
import { enrolledReport, reportOptions } from "@/lib/ext/relatorios.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { totalsBySchool, totalsBySeries } from "@/lib/ext/relatorios-logic";
import { ReportPrint, SmallTable, printNow } from "@/components/print/ReportPrint";
import { compareSchoolNames } from "@/lib/school-order";

export const Route = createFileRoute("/_authenticated/relatorios/matriculados")({
  head: () => ({
    meta: [
      { title: "Relatório de Matriculados — Grupo Inter" },
      { name: "description", content: "Fichas matriculadas por escola e período, com totais por unidade e série." },
      { property: "og:title", content: "Relatório de Matriculados — Grupo Inter" },
      { property: "og:description", content: "Matrículas efetivadas por escola, série e período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatriculadosPage,
});

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) : "—");
const br = (d: string) => d.split("-").reverse().join("/");

function MatriculadosPage() {
  const [schoolId, setSchoolId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [printAt, setPrintAt] = useState<string | null>(null);
  const { data: perms } = useQuery({ queryKey: ["my-permissions"], queryFn: () => getMyPermissions() });
  const { data: opts } = useQuery({ queryKey: ["report-options"], queryFn: () => reportOptions() });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report-enrolled", schoolId, from, to],
    queryFn: () => enrolledReport({ data: { school_id: schoolId || undefined, from: from || undefined, to: to || undefined } }),
  });
  const schools = [...(opts?.schools ?? [])].sort((a, b) => compareSchoolNames(a.name, b.name));
  const bySchool = totalsBySchool(rows);
  const bySeries = totalsBySeries(rows);
  const total = rows.reduce((t, r) => t + r.count, 0);
  const schoolLabel = schoolId ? schools.find((s) => s.id === schoolId)?.name ?? "" : [...new Set(rows.map((r) => r.school))].sort(compareSchoolNames).join(" · ") || "Todas as escolas";
  const filters = [schoolId && `Escola: ${schoolLabel}`, from && `De: ${br(from)}`, to && `Até: ${br(to)}`].filter(Boolean) as string[];
  const summary = `${rows.length} ficha${rows.length === 1 ? "" : "s"} · ${total} matrícula${total === 1 ? "" : "s"}`;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Relatório de Matriculados</h1>
          <p className="text-sm text-muted-foreground">{schoolLabel}</p>
        </div>
        <Button variant="outline" disabled={isLoading || rows.length === 0}
          onClick={() => { setPrintAt(new Date().toLocaleString("pt-BR")); printNow(); }}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="r-school">Escola</Label>
            <Select id="r-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Todas</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select></div>
          <div><Label htmlFor="r-from">Matrícula de</Label><Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="r-to">Até</Label><Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      {isLoading ? <div className="mt-8 flex justify-center"><Spinner /></div> : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card><h2 className="mb-2 font-semibold text-foreground">Por unidade — {total} matrículas</h2>
              {bySchool.map((t) => <div key={t.label} className="flex justify-between border-b border-border py-1 text-sm"><span>{t.label}</span><strong>{t.total}</strong></div>)}
            </Card>
            <Card><h2 className="mb-2 font-semibold text-foreground">Por série</h2>
              {bySeries.map((t) => <div key={t.label} className="flex justify-between border-b border-border py-1 text-sm"><span>{t.label}</span><strong>{t.total}</strong></div>)}
            </Card>
          </div>
          <Card className="mt-6 overflow-x-auto">
            <p className="mb-2 text-sm text-muted-foreground">{summary}</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">ID</th><th className="pr-3">Responsável</th><th className="pr-3">Escola</th><th className="pr-3">Crianças</th><th className="pr-3">Série</th><th className="pr-3">Qtd.</th><th className="pr-3">Data</th><th>Quem efetivou</th>
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-3 font-mono">{r.public_id}</td><td className="pr-3">{r.responsible}</td><td className="pr-3">{r.school}</td>
                  <td className="pr-3">{r.children ?? "—"}</td><td className="pr-3">{r.series.join(", ")}</td><td className="pr-3">{r.count}</td>
                  <td className="pr-3">{fmtDate(r.enrolled_at)}</td><td>{r.enrolled_by || "—"}</td>
                </tr>))}</tbody>
            </table>
          </Card>
        </>
      )}

      {printAt && (
        <ReportPrint title="Relatório de Matriculados" school={schoolLabel} filters={filters} summary={summary}
          printedBy={perms?.fullName ?? ""} printedAt={printAt}
          extra={<div style={{ display: "flex", gap: 16 }}>
            <SmallTable title="Por unidade" columns={["Unidade", "Matrículas"]} rows={bySchool.map((t) => [t.label, t.total])} />
            <SmallTable title="Por série" columns={["Série", "Total"]} rows={bySeries.map((t) => [t.label, t.total])} />
          </div>}
          columns={["ID", "Responsável", "Escola", "Crianças", "Série", "Qtd.", "Data", "Quem efetivou"]}
          rows={rows.map((r) => [r.public_id, r.responsible, r.school, r.children ?? "", r.series.join(", "), r.count, fmtDate(r.enrolled_at), r.enrolled_by])} />
      )}
    </div>
  );
}
