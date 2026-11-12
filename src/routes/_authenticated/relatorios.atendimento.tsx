import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";
import { attendanceReport, reportOptions } from "@/lib/ext/relatorios.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { totalsByAttendant } from "@/lib/ext/relatorios-logic";
import { ReportPrint, SmallTable, printNow } from "@/components/print/ReportPrint";
import { compareSchoolNames } from "@/lib/school-order";

export const Route = createFileRoute("/_authenticated/relatorios/atendimento")({
  head: () => ({
    meta: [
      { title: "Relatório de Atendimento — Grupo Inter" },
      { name: "description", content: "Cartões do CRM por escola, atendente e funil, com pendências e tarefas atrasadas." },
      { property: "og:title", content: "Relatório de Atendimento — Grupo Inter" },
      { property: "og:description", content: "Atendimentos do CRM com totais por atendente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtendimentoPage,
});

const STATUS = { open: "Aberto", won: "Ganho", lost: "Perdido" } as const;
const br = (d: string) => d.split("-").reverse().join("/");

function AtendimentoPage() {
  const [schoolId, setSchoolId] = useState("");
  const [attendant, setAttendant] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [printAt, setPrintAt] = useState<string | null>(null);
  const { data: perms } = useQuery({ queryKey: ["my-permissions"], queryFn: () => getMyPermissions() });
  const { data: opts } = useQuery({ queryKey: ["report-options"], queryFn: () => reportOptions() });
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["report-attendance", schoolId, from, to],
    queryFn: () => attendanceReport({ data: { school_id: schoolId || undefined, from: from || undefined, to: to || undefined } }),
  });
  const schools = [...(opts?.schools ?? [])].sort((a, b) => compareSchoolNames(a.name, b.name));
  const funnels = (opts?.funnels ?? []).filter((f) => !schoolId || f.school_id === schoolId);
  const attendants = [...new Set(all.map((r) => r.attendant || "Sem atendente"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const rows = all.filter((r) =>
    (!attendant || (r.attendant || "Sem atendente") === attendant) &&
    (!funnelId || r.funnel_id === funnelId) &&
    (!onlyPending || r.restricted) && (!onlyOverdue || r.overdue > 0));
  const totals = totalsByAttendant(rows);
  const schoolLabel = schoolId ? schools.find((s) => s.id === schoolId)?.name ?? "" : [...new Set(rows.map((r) => r.school))].sort(compareSchoolNames).join(" · ") || "Todas as escolas";
  const filters = [
    schoolId && `Escola: ${schoolLabel}`, attendant && `Atendente: ${attendant}`,
    funnelId && `Funil: ${funnels.find((f) => f.id === funnelId)?.name ?? ""}`,
    from && `De: ${br(from)}`, to && `Até: ${br(to)}`,
    onlyPending && "Só com pendências", onlyOverdue && "Só com tarefas atrasadas",
  ].filter(Boolean) as string[];
  const summary = `${rows.length} cartão${rows.length === 1 ? "" : "es"}`;
  const totalRows = totals.map((t) => [t.attendant, t.cards, t.open, t.won, t.lost, t.pending, t.overdue]);
  const totalCols = ["Atendente", "Cartões", "Abertos", "Ganhos", "Perdidos", "Com pendência", "Com tarefa atrasada"];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Relatório de Atendimento</h1>
          <p className="text-sm text-muted-foreground">{schoolLabel}</p>
        </div>
        <Button variant="outline" disabled={isLoading || rows.length === 0}
          onClick={() => { setPrintAt(new Date().toLocaleString("pt-BR")); printNow(); }}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label htmlFor="a-school">Escola</Label>
            <Select id="a-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setFunnelId(""); }}>
              <option value="">Todas</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select></div>
          <div><Label htmlFor="a-att">Atendente</Label>
            <Select id="a-att" value={attendant} onChange={(e) => setAttendant(e.target.value)}>
              <option value="">Todos</option>{attendants.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select></div>
          <div><Label htmlFor="a-funnel">Funil</Label>
            <Select id="a-funnel" value={funnelId} onChange={(e) => setFunnelId(e.target.value)}>
              <option value="">Todos</option>{funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select></div>
          <div><Label htmlFor="a-from">Criado de</Label><Input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="a-to">Até</Label><Input id="a-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Só com pendências</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Só com tarefas atrasadas</label>
        </div>
      </Card>

      {isLoading ? <div className="mt-8 flex justify-center"><Spinner /></div> : (
        <>
          <Card className="mt-6 overflow-x-auto">
            <h2 className="mb-2 font-semibold text-foreground">Totais por atendente</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">{totalCols.map((c) => <th key={c} className="py-2 pr-3">{c}</th>)}</tr></thead>
              <tbody>{totalRows.map((r) => <tr key={String(r[0])} className="border-b border-border">{r.map((c, i) => <td key={i} className="py-2 pr-3">{c}</td>)}</tr>)}</tbody>
            </table>
          </Card>
          <Card className="mt-6 overflow-x-auto">
            <p className="mb-2 text-sm text-muted-foreground">{summary}</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">Cliente</th><th className="pr-3">Escola</th><th className="pr-3">Funil</th><th className="pr-3">Etapa</th><th className="pr-3">Atendente</th><th className="pr-3">Status</th><th className="pr-3">Pendência</th><th>Tarefas atrasadas</th>
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-3">{r.client}</td><td className="pr-3">{r.school}</td><td className="pr-3">{r.funnel}</td><td className="pr-3">{r.stage}</td>
                  <td className="pr-3">{r.attendant || "—"}</td><td className="pr-3">{STATUS[r.status]}</td>
                  <td className="pr-3">{r.restricted ? <AlertTriangle className="h-4 w-4 text-warning" aria-label="Pendência pedagógica" /> : "—"}</td>
                  <td className={r.overdue ? "font-semibold text-destructive" : ""}>{r.overdue || "—"}</td>
                </tr>))}</tbody>
            </table>
          </Card>
        </>
      )}

      {printAt && (
        <ReportPrint title="Relatório de Atendimento" school={schoolLabel} filters={filters} summary={summary}
          printedBy={perms?.fullName ?? ""} printedAt={printAt}
          extra={<SmallTable title="Totais por atendente" columns={totalCols} rows={totalRows} />}
          columns={["Cliente", "Escola", "Funil", "Etapa", "Atendente", "Status", "Pendência", "Tarefas atrasadas"]}
          rows={rows.map((r) => [r.client, r.school, r.funnel, r.stage, r.attendant, STATUS[r.status], r.restricted ? "Sim" : "", r.overdue || ""])} />
      )}
    </div>
  );
}
