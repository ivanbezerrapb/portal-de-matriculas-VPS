// Somente servidor: clientes do Supabase externo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

// Chaves novas (sb_publishable_/sb_secret_) não são JWTs: enviar só como apikey.
function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    }
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

// Cliente anônimo (sem sessão) — respeita RLS como anon.
export function extAnon(): SupabaseClient {
  const key = env("EXT_SUPABASE_PUBLISHABLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch(key) },
  });
}

// Cliente autenticado como o usuário do token — respeita RLS como o usuário.
export function extUserClient(token: string): SupabaseClient {
  const key = env("EXT_SUPABASE_PUBLISHABLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: supabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

// Cliente service role — ignora RLS. Apenas operações privilegiadas.
export function extAdmin(): SupabaseClient {
  const key = env("EXT_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch(key) },
  });
}

// Garante o campo interno "Quantidade de crianças" do formulário e devolve seu id.
export async function ensureChildrenCountField(
  supabase: SupabaseClient,
  formId: string,
): Promise<string | null> {
  const { CHILDREN_COUNT_LABEL } = await import("./model");
  const { data: existing } = await supabase
    .from("form_fields")
    .select("id")
    .eq("form_id", formId)
    .eq("internal", true)
    .eq("label", CHILDREN_COUNT_LABEL)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("form_fields")
    .insert({
      form_id: formId,
      label: CHILDREN_COUNT_LABEL,
      type: "number",
      required: false,
      internal: true,
      position: ((last?.position as number | undefined) ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return null;
  return (created?.id as string) ?? null;
}

// Grava a quantidade de crianças como resposta do cadastro.
export async function writeChildrenCountValue(
  supabase: SupabaseClient,
  formId: string,
  submissionId: string,
  count: number | null,
): Promise<void> {
  const fieldId = await ensureChildrenCountField(supabase, formId);
  if (!fieldId) return;
  await supabase.from("submission_values").upsert(
    {
      submission_id: submissionId,
      field_id: fieldId,
      part: "",
      value: count == null ? "" : String(count),
      value_number: count,
    },
    { onConflict: "submission_id,field_id,part" },
  );
}

export type Perms = {
  isAdmin: boolean;
  isDirecao: boolean;
  isEditor: boolean;
  infoSchools: string[];
  managerSchools: string[];
  operatorSchools: string[];
  funnelIds: string[];
  roles: { role: string; school_id: string | null }[];
};

// Lê os papéis do usuário usando o cliente dele (RLS permite ver os próprios papéis).
export async function getPerms(supabase: SupabaseClient, userId: string): Promise<Perms> {
  const [{ data }, { data: funnelRows }] = await Promise.all([
    supabase.from("user_roles").select("role, school_id").eq("user_id", userId),
    supabase.from("user_funnels").select("funnel_id").eq("user_id", userId),
  ]);
  const rows = (data ?? []) as { role: string; school_id: string | null }[];
  return {
    isAdmin: rows.some((r) => r.role === "admin"),
    isDirecao: rows.some((r) => r.role === "direcao"),
    isEditor: rows.some((r) => r.role === "submission_editor"),
    managerSchools: rows
      .filter((r) => r.role === "school_manager" && r.school_id)
      .map((r) => r.school_id as string),
    infoSchools: rows
      .filter((r) => r.role === "info_center" && r.school_id)
      .map((r) => r.school_id as string),
    operatorSchools: rows
      .filter((r) => r.role === "print_operator" && r.school_id)
      .map((r) => r.school_id as string),
    funnelIds: ((funnelRows ?? []) as { funnel_id: string }[]).map((r) => r.funnel_id),
    roles: rows,
  };
}

// Garante que cartões abertos de cadastros com check-in (LEADS) ou matrícula
// realizada (Visitantes) sejam dados como ganhos, na etapa correta, com tarefas
// concluídas e registro no Histórico. Idempotente; seguro chamar com frequência.
const normTxt = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)).replace(",", " às");

export async function reconcileWonOpportunities(
  admin: SupabaseClient,
  submissionIds?: string[],
): Promise<{ id: string; kind: "checkin" | "matricula" }[]> {
  let oq = admin
    .from("opportunities")
    .select("id, funnel_id, submission_id, submissions!inner(list_type, enrolled, enrolled_at, enrolled_by)")
    .eq("status", "open")
    .not("submission_id", "is", null);
  if (submissionIds?.length) oq = oq.in("submission_id", submissionIds);
  const { data: opps, error } = await oq;
  if (error) throw new Error(error.message);
  type O = {
    id: string; funnel_id: string; submission_id: string;
    submissions: { list_type: string | null; enrolled: boolean | null; enrolled_at: string | null; enrolled_by: string | null };
  };
  const list = (opps ?? []) as unknown as O[];
  if (!list.length) return [];

  const leadSubs = list.filter((o) => o.submissions.list_type === "leads").map((o) => o.submission_id);
  const checkins = new Map<string, { at: string; by: string | null; email: string | null }>();
  if (leadSubs.length) {
    const { data: logs } = await admin
      .from("audit_log")
      .select("submission_id, created_at, actor_id, actor_email")
      .eq("action", "check_in")
      .in("submission_id", leadSubs)
      .order("created_at", { ascending: true });
    for (const l of (logs ?? []) as { submission_id: string; created_at: string; actor_id: string | null; actor_email: string | null }[])
      if (!checkins.has(l.submission_id)) checkins.set(l.submission_id, { at: l.created_at, by: l.actor_id, email: l.actor_email });
  }

  const targets = list
    .map((o) => {
      if (o.submissions.list_type === "leads") {
        const c = checkins.get(o.submission_id);
        return c ? { o, kind: "checkin" as const, at: c.at, by: c.by, email: c.email } : null;
      }
      if (o.submissions.enrolled)
        return { o, kind: "matricula" as const, at: o.submissions.enrolled_at ?? new Date().toISOString(), by: o.submissions.enrolled_by, email: null };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!targets.length) return [];

  const funnelIds = [...new Set(targets.map((t) => t.o.funnel_id))];
  const userIds = [...new Set(targets.map((t) => t.by).filter((x): x is string => !!x))];
  const [{ data: stages }, { data: profs }, { data: reason }] = await Promise.all([
    admin.from("funnel_stages").select("id, name, funnel_id").in("funnel_id", funnelIds),
    userIds.length ? admin.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    admin.from("crm_close_reasons").select("id").eq("kind", "won").eq("label", "Matrícula realizada").maybeSingle(),
  ]);
  const names = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const now = new Date().toISOString();
  const done: { id: string; kind: "checkin" | "matricula" }[] = [];

  for (const t of targets) {
    const fs = ((stages ?? []) as { id: string; name: string; funnel_id: string }[]).filter((s) => s.funnel_id === t.o.funnel_id);
    const stage = fs.find((s) => normTxt(s.name).includes(t.kind === "checkin" ? "realizad" : "matriculado"));
    const author = (t.by && names.get(t.by)) || t.email || "Sistema";
    await admin.from("crm_tasks").update({ done: true, done_at: now }).eq("opportunity_id", t.o.id).eq("done", false);
    const { data: upd, error: upErr } = await admin
      .from("opportunities")
      .update({
        status: "won",
        close_reason_id: t.kind === "matricula" ? ((reason?.id as string | undefined) ?? null) : null,
        close_note: t.kind === "checkin" ? "Check-in confirmado (visita realizada)." : "Matrícula realizada.",
        closed_at: t.at,
        updated_at: now,
        ...(stage ? { stage_id: stage.id } : {}),
      })
      .eq("id", t.o.id)
      .eq("status", "open")
      .select("id");
    if (upErr || !upd?.length) continue;
    await admin.from("crm_notes").insert({
      opportunity_id: t.o.id,
      author_id: t.by,
      author_name: author,
      body: t.kind === "checkin"
        ? `Visita realizada em ${fmtWhen(t.at)} — check-in por ${author}.`
        : `Matrícula realizada em ${fmtWhen(t.at)} — por ${author}.`,
    });
    done.push({ id: t.o.id, kind: t.kind });
  }
  return done;
}
