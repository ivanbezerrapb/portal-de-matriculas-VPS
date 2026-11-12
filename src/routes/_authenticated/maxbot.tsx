import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Eye, EyeOff, FlaskConical, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { getMaxbotSettings, listMaxbotSegmentations, listMaxbotTemplatesAdmin, saveMaxbotDefaultTemplate, runMaxbotImport, saveMaxbotImport, saveMaxbotSettings, testMaxbotConnection } from "@/lib/ext/maxbot.functions";
import { compareSchoolNames } from "@/lib/school-order";
import { Badge, Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/maxbot")({
  head: () => ({
    meta: [
      { title: "Maxbot — Grupo Inter" },
      { name: "description", content: "Credenciais e configurações da integração com o Maxbot." },
      { property: "og:title", content: "Maxbot — Grupo Inter" },
      { property: "og:description", content: "Configuração da integração do portal com o Maxbot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaxbotPage,
});

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

type Account = "conecta" | "interactivo";
type View = Awaited<ReturnType<typeof getMaxbotSettings>>["conecta"];
type SchoolT = Awaited<ReturnType<typeof getMaxbotSettings>>["schools"][number];

function MaxbotPage() {
  const getFn = useServerFn(getMaxbotSettings);
  const { data, isLoading } = useQuery({ queryKey: ["maxbot-settings"], queryFn: () => getFn() });
  if (isLoading || !data) return <div className="p-8"><Spinner /></div>;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Maxbot</h1>
        <p className="text-sm text-muted-foreground">Credenciais de cada conta do Maxbot. Conecta atende Centro e Expedicionários; Interactivo atende Cristo e Bessa.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AccountCard account="conecta" title="Maxbot Conecta" data={data.conecta} schools={data.schools.filter((x) => x.brand === "conecta")} />
        <AccountCard account="interactivo" title="Maxbot Interactivo" data={data.interactivo} schools={data.schools.filter((x) => x.brand === "interactivo")} />
      </div>
    </div>
  );
}

function AccountCard({ account, title, data, schools }: { account: Account; title: string; data: View; schools: SchoolT[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveMaxbotSettings);
  const testFn = useServerFn(testMaxbotConnection);
  const [apiUrl, setApiUrl] = useState(data.api_url);
  const [enabled, setEnabled] = useState(data.enabled);
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { setApiUrl(data.api_url); setEnabled(data.enabled); }, [data.api_url, data.enabled]);

  async function save(clear = false) {
    setSaving(true);
    try {
      await saveFn({ data: { account, api_url: apiUrl, enabled: clear ? false : enabled, token: token || undefined, clear_token: clear } });
      setToken("");
      toast.success(clear ? `Token do ${title} removido.` : `Configuração do ${title} salva.`);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await testFn({ data: { account } });
      r.ok ? toast.success(`${title}: ${r.message}`) : toast.error(`${title}: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no teste.");
    } finally { setTesting(false); }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <Badge>{data.enabled ? "Ativa" : "Desativada"}</Badge>
      </div>
      <div className="space-y-2">
        <Label>Token da API</Label>
        {data.token_set && (
          <div className="flex items-center gap-2">
            <Badge>Token configurado</Badge>
            <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { if (confirm(`Remover o token do ${title}? A integração será desativada.`)) save(true); }}>Remover token</button>
          </div>
        )}
        <div className="relative">
          <Input type={show ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={data.token_set ? "Digite um novo token para substituir" : "Cole aqui o token gerado no Maxbot"} autoComplete="off" className="pr-10" />
          <button type="button" aria-label={show ? "Ocultar token" : "Mostrar token"} onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">O token fica guardado com segurança e nunca é exibido depois de salvo.</p>
      </div>
      <div className="space-y-2">
        <Label>Endereço da API</Label>
        <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Integração ativa
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        <Button variant="outline" onClick={test} disabled={testing || !data.token_set}>
          <PlugZap className="h-4 w-4" />{testing ? "Testando..." : "Testar conexão"}
        </Button>
      </div>
      {data.token_set && <DefaultTemplate account={account} />}
      {data.token_set && <ImportSection account={account} title={title} data={data} schools={schools} />}
      <div className="space-y-1 border-t border-border pt-4 text-sm">
        <p><span className="text-muted-foreground">Última alteração:</span> {fmt(data.updated_at)}{data.updated_by_name ? ` por ${data.updated_by_name}` : ""}</p>
        <p><span className="text-muted-foreground">Último teste:</span> {fmt(data.last_test_at)}
          {data.last_test_at && <span className={data.last_test_ok ? " text-primary" : " text-destructive"}> — {data.last_test_message}</span>}</p>
      </div>
    </Card>
  );
}

function ImportSection({ account, title, data, schools }: { account: Account; title: string; data: View; schools: SchoolT[] }) {
  const qc = useQueryClient();
  const segFn = useServerFn(listMaxbotSegmentations);
  const saveFn = useServerFn(saveMaxbotImport);
  const runFn = useServerFn(runMaxbotImport);
  const segs = useQuery({ queryKey: ["maxbot-segs", account], queryFn: () => segFn({ data: { account } }) });
  const [map, setMap] = useState<Record<string, string>>(data.segmentations);
  const [since, setSince] = useState(data.import_since ?? "");
  const [auto, setAuto] = useState(data.import_enabled);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const ordered = [...schools].sort((a, b) => compareSchoolNames(a.name, b.name));
  const options = segs.data?.items ?? [];

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: { account, segmentations: map, import_since: since || null, import_enabled: auto } });
      toast.success(`Importação do ${title} salva.`);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function run() {
    setRunning(true);
    try {
      const r = await runFn({ data: { account } });
      r.ok ? toast.success(`${title}: ${r.message}`) : toast.error(`${title}: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na importação.");
    } finally { setRunning(false); }
  }

  // Roda na hora com a etiqueta e a data que estão na tela, sem precisar salvar antes.
  async function testNow() {
    if (!since) { toast.error("Escolha a data inicial."); return; }
    if (Object.values(map).filter((v) => v.trim()).length === 0) { toast.error("Escolha a etiqueta de ao menos uma unidade."); return; }
    setTesting(true);
    try {
      const r = await runFn({ data: { account, segmentations: map, import_since: since, test: true } });
      r.ok ? toast.success(`${title}: ${r.message}`) : toast.error(`${title}: ${r.message}`);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no teste.");
    } finally { setTesting(false); }
  }

  const li = data.last_import;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <h3 className="font-display text-base font-bold text-foreground">Importação de LEADS</h3>
      {segs.isLoading ? <Spinner /> : segs.data?.error ? (
        <p className="text-sm text-destructive">{segs.data.error}</p>
      ) : null}
      {ordered.map((sc) => (
        <div key={sc.id} className="space-y-1">
          <Label>Etiqueta da unidade {sc.name}</Label>
          <Select value={map[sc.id] ?? ""} onChange={(e) => setMap({ ...map, [sc.id]: e.target.value })}>
            <option value="">Não importar</option>
            {map[sc.id] && !options.some((o) => o.title === map[sc.id]) && <option value={map[sc.id]}>{map[sc.id]}</option>}
            {options.map((o) => <option key={o.id} value={o.title}>{o.title}</option>)}
          </Select>
          {map[sc.id] && segs.data && !options.some((o) => o.title === map[sc.id]) && (
            <p className="text-xs text-destructive">Essa etiqueta não existe mais com esse nome no Maxbot. Escolha a etiqueta certa e salve.</p>
          )}
        </div>
      ))}
      <div className="space-y-1">
        <Label>Buscar contatos cadastrados a partir de</Label>
        <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Importação automática (a cada 10 minutos)
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar importação"}</Button>
        <Button variant="outline" onClick={testNow} disabled={testing || running}>
          <FlaskConical className="h-4 w-4" />{testing ? "Testando..." : "Testar agora"}
        </Button>
        <Button variant="outline" onClick={run} disabled={running || !data.import_since}>{running ? "Importando..." : "Importar agora"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Testar agora</span> roda a importação na hora com a etiqueta e a data que estão nesta tela,
        sem precisar salvar antes. Os leads encontrados entram de verdade na Lista de LEADS.
      </p>
      <p className="text-sm">
        <span className="text-muted-foreground">Última importação:</span> {fmt(li?.at ?? null)}
        {li && <span className={li.ok ? " text-primary" : " text-destructive"}> — {li.message}{li.ok ? ` (encontrados ${li.found}, importados ${li.imported}, já existentes ${li.skipped})` : ""}</span>}
      </p>
    </div>
  );
}

function DefaultTemplate({ account }: { account: Account }) {
  const listFn = useServerFn(listMaxbotTemplatesAdmin);
  const saveFn = useServerFn(saveMaxbotDefaultTemplate);
  const q = useQuery({ queryKey: ["maxbot-default-tpl", account], queryFn: () => listFn({ data: { account } }), retry: false });
  const [sel, setSel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = sel ?? q.data?.current ?? "";
  const save = async () => {
    setSaving(true);
    try {
      const t = q.data?.templates.find((x) => x.id === value);
      await saveFn({ data: { account, id: value, title: t?.title ?? "" } });
      toast.success("Template padrão salvo.");
      q.refetch(); setSel(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <Label>Template padrão do botão "Enviar mensagem"</Label>
      {q.isLoading ? <Spinner /> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar os templates.</p> : (
        <div className="flex gap-2">
          <Select value={value} onChange={(e) => setSel(e.target.value)}>
            <option value="">Nenhum (escolher na hora)</option>
            {q.data?.templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.type === "A" ? "Aviso" : "Follow-up"})</option>)}
          </Select>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Esse template já vem escolhido quando o atendente clica em Enviar mensagem. Ele ainda pode trocar.</p>
    </div>
  );
}
