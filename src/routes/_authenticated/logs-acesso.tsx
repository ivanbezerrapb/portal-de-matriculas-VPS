import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getAccessSummary, listAccessEvents } from "@/lib/ext/logs.functions";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/logs-acesso")({
  head: () => ({
    meta: [
      { title: "Log de Acesso — Grupo Inter" },
      { name: "description", content: "Último acesso e histórico de entradas dos usuários do portal." },
      { property: "og:title", content: "Log de Acesso — Grupo Inter" },
      { property: "og:description", content: "Acompanhe quem acessou e quem não acessou o portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogsAcessoPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  direcao: "Direção",
  school_manager: "Gerente",
  info_center: "Central de Informações",
  print_operator: "Secretaria",
  submission_editor: "Editor",
};
const EVENT_LABEL: Record<string, string> = {
  login: "Entrou",
  session: "Abriu o portal",
  logout: "Saiu",
  failed: "Senha incorreta",
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

function situation(last: string | null) {
  if (!last) return { key: "never", label: "Nunca acessou", cls: "bg-muted text-muted-foreground" };
  const t = new Date(last);
  const now = new Date();
  if (t.toDateString() === now.toDateString())
    return { key: "today", label: "Acessou hoje", cls: "bg-primary/15 text-primary" };
  if (now.getTime() - t.getTime() <= 7 * 86400_000)
    return { key: "week", label: "Últimos 7 dias", cls: "bg-secondary text-secondary-foreground" };
  return { key: "old", label: "Sem acesso há +7 dias", cls: "bg-destructive/15 text-destructive" };
}

function device(ua: string | null) {
  if (!ua) return "—";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return os ? `${br} · ${os}` : br;
}

function LogsAcessoPage() {
  const [tab, setTab] = useState<"users" | "events">("users");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Log de Acesso</h1>
        <p className="text-sm text-muted-foreground">Último acesso de cada usuário e histórico de entradas.</p>
      </div>
      <div className="flex gap-2">
        <Button variant={tab === "users" ? "primary" : "outline"} onClick={() => setTab("users")}>Por usuário</Button>
        <Button variant={tab === "events" ? "primary" : "outline"} onClick={() => setTab("events")}>Histórico</Button>
      </div>
      {tab === "users" ? <UsersTab /> : <EventsTab />}
    </div>
  );
}

function UsersTab() {
  const { data, isLoading } = useQuery({ queryKey: ["access-summary"], queryFn: () => getAccessSummary(), refetchInterval: 60_000 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [sit, setSit] = useState("");
  const rows = useMemo(
    () =>
      (data ?? []).filter((u) => {
        const s = search.toLowerCase();
        if (s && !u.name.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
        if (role && !u.roles.includes(role)) return false;
        if (sit && situation(u.last_access).key !== sit) return false;
        return true;
      }),
    [data, search, role, sit],
  );
  return (
    <Card className="p-0">
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
        <div><Label>Buscar</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" /></div>
        <div><Label>Perfil</Label><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="">Todos</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div><Label>Situação</Label><Select value={sit} onChange={(e) => setSit(e.target.value)}><option value="">Todas</option><option value="today">Acessou hoje</option><option value="week">Últimos 7 dias</option><option value="old">Sem acesso há +7 dias</option><option value="never">Nunca acessou</option></Select></div>
      </div>
      {isLoading ? <div className="p-8 text-center"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Usuário</th><th className="px-4 py-2">Perfil</th><th className="px-4 py-2">Unidade(s)</th><th className="px-4 py-2">Último acesso</th><th className="px-4 py-2">Acessos (30 dias)</th><th className="px-4 py-2">Situação</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const s = situation(u.last_access);
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-2"><div className="font-medium text-foreground">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="px-4 py-2">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ") || "—"}</td>
                    <td className="px-4 py-2">{u.schools.join(", ") || "Todas"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmt(u.last_access)}</td>
                    <td className="px-4 py-2">{u.count30}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EventsTab() {
  const [page, setPage] = useState(0);
  const [event, setEvent] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filters = { page, event: event || undefined, search: search || undefined, from: from || undefined, to: to || undefined };
  const { data, isLoading } = useQuery({ queryKey: ["access-events", filters], queryFn: () => listAccessEvents({ data: filters }), refetchInterval: 30_000 });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));
  return (
    <Card className="p-0">
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-4">
        <div><Label>E-mail</Label><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
        <div><Label>Evento</Label><Select value={event} onChange={(e) => { setEvent(e.target.value); setPage(0); }}><option value="">Todos</option>{Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
      </div>
      {isLoading ? <div className="p-8 text-center"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Data e hora</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Evento</th><th className="px-4 py-2">Navegador</th></tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2">{r.email || "—"}</td>
                  <td className={`px-4 py-2 font-medium ${r.event === "failed" ? "text-destructive" : ""}`}>{EVENT_LABEL[r.event] ?? r.event}</td>
                  <td className="px-4 py-2 text-muted-foreground">{device(r.user_agent)}</td>
                </tr>
              ))}
              {(data?.rows.length ?? 0) === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro ainda.</td></tr>}
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
  );
}
