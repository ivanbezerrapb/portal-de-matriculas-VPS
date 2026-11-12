import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { listActivity, listLogFilterOptions, type ActivityRow } from "@/lib/ext/logs.functions";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/logs-registro")({
  head: () => ({
    meta: [
      { title: "Log de Registro — Grupo Inter" },
      { name: "description", content: "Todas as criações, alterações e exclusões feitas no portal." },
      { property: "og:title", content: "Log de Registro — Grupo Inter" },
      { property: "og:description", content: "Histórico completo de movimentações dos usuários no portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogsRegistroPage,
});

const AREA: Record<string, string> = {
  submissions: "Cadastros",
  submission_values: "Respostas do cadastro",
  opportunities: "Pipeline (cartões)",
  crm_tasks: "Tarefas",
  crm_notes: "Histórico do cartão",
  crm_task_types: "Atividades",
  crm_close_reasons: "Motivos",
  funnels: "Funis",
  funnel_stages: "Etapas do funil",
  forms: "Formulários",
  form_fields: "Campos do formulário",
  form_destinations: "Destino",
  form_destination_rules: "Regras de destino",
  print_templates: "Modelo de impressão",
  print_template_library: "Templates",
  schools: "Escolas",
  profiles: "Usuários",
  user_roles: "Permissões",
  user_funnels: "Funis do usuário",
  presenters: "Nomes (Atendimento)",
  shared_files: "Central de Arquivos",
  file_categories: "Categorias de arquivos",
  legacy_datasets: "Bancos anteriores",
  maxbot_settings: "Maxbot",
};
const ACTION: Record<string, { label: string; cls: string }> = {
  insert: { label: "Criou", cls: "bg-primary/15 text-primary" },
  update: { label: "Alterou", cls: "bg-secondary text-secondary-foreground" },
  delete: { label: "Excluiu", cls: "bg-destructive/15 text-destructive" },
};

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function LogsRegistroPage() {
  const [page, setPage] = useState(0);
  const [f, setF] = useState({ table: "", action: "", actor: "", school: "", search: "", from: "", to: "" });
  const [detail, setDetail] = useState<ActivityRow | null>(null);
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const filters = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const { data: opts } = useQuery({ queryKey: ["log-opts"], queryFn: () => listLogFilterOptions() });
  const { data, isLoading } = useQuery({
    queryKey: ["activity", page, filters],
    queryFn: () => listActivity({ data: { page, ...filters } }),
    refetchInterval: 30_000,
  });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));
  const schoolName = new Map((opts?.schools ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Log de Registro</h1>
        <p className="text-sm text-muted-foreground">Toda criação, alteração e exclusão feita no portal.</p>
      </div>
      <Card className="p-0">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3 lg:grid-cols-7">
          <div className="lg:col-span-2"><Label>Buscar</Label><Input value={f.search} onChange={(e) => set("search", e.target.value)} placeholder="Item ou usuário" /></div>
          <div><Label>Usuário</Label><Select value={f.actor} onChange={(e) => set("actor", e.target.value)}><option value="">Todos</option><option value="system">Sistema</option>{opts?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></div>
          <div><Label>Área</Label><Select value={f.table} onChange={(e) => set("table", e.target.value)}><option value="">Todas</option>{Object.entries(AREA).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
          <div><Label>Ação</Label><Select value={f.action} onChange={(e) => set("action", e.target.value)}><option value="">Todas</option>{Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
          <div><Label>Unidade</Label><Select value={f.school} onChange={(e) => set("school", e.target.value)}><option value="">Todas</option>{opts?.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div className="grid grid-cols-2 gap-2"><div><Label>De</Label><Input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} /></div><div><Label>Até</Label><Input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} /></div></div>
        </div>
        {isLoading ? <div className="p-8 text-center"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Data e hora</th><th className="px-4 py-2">Usuário</th><th className="px-4 py-2">Ação</th><th className="px-4 py-2">Área</th><th className="px-4 py-2">Item</th><th className="px-4 py-2">Unidade</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r) => {
                  const a = ACTION[r.action] ?? { label: r.action, cls: "" };
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2">{r.actor_name || (r.actor_id ? "Usuário" : "Sistema")}</td>
                      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.cls}`}>{a.label}</span></td>
                      <td className="px-4 py-2">{AREA[r.table_name] ?? r.table_name}</td>
                      <td className="max-w-[280px] truncate px-4 py-2" title={r.label ?? ""}>{r.label || "—"}</td>
                      <td className="px-4 py-2">{r.school_id ? schoolName.get(r.school_id) ?? "—" : "—"}</td>
                      <td className="px-4 py-2"><Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setDetail(r)}>O que mudou</Button></td>
                    </tr>
                  );
                })}
                {(data?.rows.length ?? 0) === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border p-3 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} registros</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span>{page + 1} / {pages}</span>
            <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setDetail(null)}>
          <Card className="max-h-[85vh] w-full max-w-3xl overflow-y-auto" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">{(ACTION[detail.action]?.label ?? detail.action)} · {AREA[detail.table_name] ?? detail.table_name}</h2>
                  <p className="text-xs text-muted-foreground">{detail.actor_name || "Sistema"} · {new Date(detail.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetail(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1 pr-3">Campo</th><th className="py-1 pr-3">Antes</th><th className="py-1">Depois</th></tr></thead>
                <tbody>
                  {[...new Set([...Object.keys(detail.old_data ?? {}), ...Object.keys(detail.new_data ?? {})])].map((k) => (
                    <tr key={k} className="border-t border-border align-top">
                      <td className="py-1 pr-3 font-medium">{k}</td>
                      <td className="break-all py-1 pr-3 text-muted-foreground">{show(detail.old_data?.[k])}</td>
                      <td className="break-all py-1">{show(detail.new_data?.[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
