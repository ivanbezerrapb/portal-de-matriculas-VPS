import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LogOut, Pencil, Plus, QrCode, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import {
  connectWhatsappInstance,
  createWhatsappInstance,
  deleteWhatsappInstance,
  listWhatsappInstances,
  logoutWhatsappInstance,
  refreshWhatsappInstance,
  resetWhatsappWebhook,
  sendWhatsappTest,
  updateWhatsappInstance,
  type WhatsappInstance,
} from "@/lib/ext/whatsapp.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { compareSchoolNames } from "@/lib/school-order";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Grupo Inter" },
      { name: "description", content: "Instâncias de WhatsApp conectadas ao portal." },
      { property: "og:title", content: "WhatsApp — Grupo Inter" },
      { property: "og:description", content: "Instâncias de WhatsApp conectadas ao portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsappPage,
});

type School = { id: string; name: string };

const STATUS: Record<WhatsappInstance["status"], { label: string; color: "green" | "amber" | "red" }> = {
  open: { label: "Conectado", color: "green" },
  connecting: { label: "Aguardando QR Code", color: "amber" },
  close: { label: "Desconectado", color: "red" },
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function fmtPhone(p: string | null) {
  if (!p) return "—";
  const d = p.startsWith("55") ? p.slice(2) : p;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

function WhatsappPage() {
  const listFn = useServerFn(listWhatsappInstances);
  const schoolsFn = useServerFn(listSchools);
  const createFn = useServerFn(createWhatsappInstance);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: () => listFn(),
    // Enquanto alguma instância espera o QR Code, atualiza sozinho para mostrar quando conectar.
    refetchInterval: (q) =>
      q.state.data?.instances.some((i) => i.status === "connecting") ? 3000 : false,
  });
  const { data: schoolsRaw } = useQuery({ queryKey: ["schools"], queryFn: () => schoolsFn() });
  const schools = ((schoolsRaw ?? []) as School[]).slice().sort((a, b) => compareSchoolNames(a.name, b.name));

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", school_id: "" });
  const [saving, setSaving] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createFn({ data: { name: form.name, school_id: form.school_id || null } });
      toast.success("Instância criada. Leia o QR Code com o WhatsApp do número.");
      setCreating(false);
      setForm({ name: "", school_id: "" });
      qc.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) return <div className="p-8"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Configurações</p>
          <h1 className="font-display text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Números de WhatsApp conectados ao portal pela Evolution API. Cada instância pode atender uma unidade ou todas.
          </p>
        </div>
        {data.isAdmin && data.configured && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova instância
          </Button>
        )}
      </div>

      {!data.configured && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            A Evolution API ainda não está configurada no servidor. Defina as variáveis{" "}
            <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> e <code>PUBLIC_APP_URL</code>.
          </p>
        </Card>
      )}

      {creating && (
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
            <div className="min-w-56 flex-1">
              <Label>Nome da instância</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Central Conecta"
                required
                minLength={2}
                maxLength={60}
              />
            </div>
            <div className="min-w-56 flex-1">
              <Label>Unidade</Label>
              <Select value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })}>
                <option value="">Todas as unidades</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar e gerar QR Code"}</Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {data.instances.length === 0 ? (
        <EmptyState
          title="Nenhuma instância"
          description={data.isAdmin ? "Crie a primeira instância e conecte um número pelo QR Code." : "Nenhum número de WhatsApp disponível para a sua unidade."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.instances.map((inst) => (
            <InstanceCard key={inst.id} inst={inst} schools={schools} isAdmin={data.isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstanceCard({ inst, schools, isAdmin }: { inst: WhatsappInstance; schools: School[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const connectFn = useServerFn(connectWhatsappInstance);
  const refreshFn = useServerFn(refreshWhatsappInstance);
  const logoutFn = useServerFn(logoutWhatsappInstance);
  const deleteFn = useServerFn(deleteWhatsappInstance);
  const webhookFn = useServerFn(resetWhatsappWebhook);
  const updateFn = useServerFn(updateWhatsappInstance);
  const testFn = useServerFn(sendWhatsappTest);

  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: inst.name, school_id: inst.school_id ?? "", active: inst.active });
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState({ phone: "", text: "Mensagem de teste do Portal de Matrículas." });
  const [pairing, setPairing] = useState<string | null>(null);

  const st = STATUS[inst.status];
  const school = schools.find((s) => s.id === inst.school_id);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string): Promise<boolean> {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      qc.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{inst.name}</h2>
          <p className="text-sm text-muted-foreground">
            {school?.name ?? "Todas as unidades"}
            {!inst.active && " · Inativa"}
          </p>
        </div>
        <Badge color={st.color}>{st.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <p><span className="text-muted-foreground">Número:</span> {fmtPhone(inst.phone)}</p>
        <p><span className="text-muted-foreground">Perfil:</span> {inst.profile_name ?? "—"}</p>
        <p className="col-span-2"><span className="text-muted-foreground">Último evento:</span> {fmt(inst.last_event_at)}</p>
      </div>

      {isAdmin && inst.status !== "open" && inst.qr_base64 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white p-4">
          <img src={inst.qr_base64} alt={`QR Code da instância ${inst.name}`} className="h-56 w-56" />
          <p className="text-center text-xs text-muted-foreground">
            No celular: WhatsApp › Aparelhos conectados › Conectar aparelho. O código expira em poucos segundos; se expirar, gere outro.
          </p>
          {pairing && <p className="text-sm">Código de pareamento: <strong>{pairing}</strong></p>}
        </div>
      )}

      {isAdmin && editing && (
        <form
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "edit",
              () => updateFn({ data: { id: inst.id, name: draft.name, school_id: draft.school_id || null, active: draft.active } }),
              "Instância atualizada.",
            ).then((ok) => ok && setEditing(false));
          }}
        >
          <div>
            <Label>Nome</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required minLength={2} maxLength={60} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Select value={draft.school_id} onChange={(e) => setDraft({ ...draft, school_id: e.target.value })}>
              <option value="">Todas as unidades</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Instância ativa (recebe e envia mensagens no portal)
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy === "edit"}>Salvar</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {isAdmin && testing && (
        <form
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("test", () => testFn({ data: { id: inst.id, phone: test.phone, text: test.text } }), "Mensagem enviada.").then(
              (ok) => ok && setTesting(false),
            );
          }}
        >
          <div>
            <Label>Número (com DDD)</Label>
            <Input value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="(83) 99999-0000" required />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Input value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} required maxLength={1000} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy === "test"}><Send className="h-4 w-4" /> Enviar</Button>
            <Button type="button" variant="outline" onClick={() => setTesting(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {inst.status !== "open" && (
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                run("connect", async () => {
                  const r = await connectFn({ data: { id: inst.id } });
                  setPairing(r.pairing_code ?? null);
                  if (r.status === "open") toast.success("Instância já está conectada.");
                })
              }
            >
              <QrCode className="h-4 w-4" /> {inst.qr_base64 ? "Novo QR Code" : "Conectar"}
            </Button>
          )}
          <Button variant="outline" disabled={!!busy} onClick={() => run("refresh", () => refreshFn({ data: { id: inst.id } }), "Status atualizado.")}>
            <RefreshCw className="h-4 w-4" /> Atualizar status
          </Button>
          {inst.status === "open" && (
            <Button variant="outline" disabled={!!busy} onClick={() => setTesting(!testing)}>
              <Send className="h-4 w-4" /> Testar envio
            </Button>
          )}
          <Button variant="ghost" disabled={!!busy} onClick={() => setEditing(!editing)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => run("webhook", () => webhookFn({ data: { id: inst.id } }), "Webhook reconfigurado.")}
          >
            <Webhook className="h-4 w-4" /> Reconfigurar webhook
          </Button>
          {inst.status === "open" && (
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() => {
                if (confirm(`Desconectar o número da instância "${inst.name}"? Será preciso ler o QR Code de novo.`))
                  run("logout", () => logoutFn({ data: { id: inst.id } }), "Instância desconectada.");
              }}
            >
              <LogOut className="h-4 w-4" /> Desconectar
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => {
              if (confirm(`Excluir a instância "${inst.name}"? As conversas e mensagens dela no portal também serão apagadas.`))
                run("delete", () => deleteFn({ data: { id: inst.id } }), "Instância excluída.");
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" /> Excluir
          </Button>
        </div>
      )}
    </Card>
  );
}
