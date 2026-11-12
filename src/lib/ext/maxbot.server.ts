import { compareSchoolNames } from "@/lib/school-order";
import type { SupabaseClient } from "@supabase/supabase-js";

// Núcleo da integração Maxbot (somente servidor).
export const BUCKET = "integracoes";
export const PATH = "maxbot.json";
export const DEFAULT_URL = "https://app.maxbot.com.br/api/v1.php";
export const ACCOUNTS = ["conecta", "interactivo"] as const;
export type Account = (typeof ACCOUNTS)[number];
export const ACCOUNT_LABEL: Record<Account, string> = { conecta: "Maxbot Conecta", interactivo: "Maxbot Interactivo" };

export type ImportSummary = { at: string; ok: boolean; found: number; imported: number; skipped: number; message: string };

export type Stored = {
  api_url: string;
  enabled: boolean;
  token: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_message?: string | null;
  // Importação de LEADS
  segmentations?: Record<string, string>; // schoolId -> título da segmentação
  import_since?: string | null; // AAAA-MM-DD
  import_enabled?: boolean;
  last_import?: ImportSummary | null;
  imported?: Record<string, string>; // contactId -> submissionId
  attendants?: Record<string, { id: string; name: string }>; // portalUserId -> atendente Maxbot
  contacts?: Record<string, string>; // opportunityId -> contactId Maxbot
  named?: Record<string, string>; // contactId -> código da ficha já gravado no nome
  tagged?: Record<string, string[]>; // contactId -> schoolIds cuja etiqueta já foi adicionada
  default_template?: { id: string; title: string } | null;
};
export type All = Record<Account, Stored>;

export function empty(): Stored {
  return { api_url: DEFAULT_URL, enabled: false, token: null, updated_by: null, updated_by_name: null, updated_at: null };
}

export async function readAll(db: SupabaseClient): Promise<All> {
  const all: All = { conecta: empty(), interactivo: empty() };
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return all;
  try {
    const raw = JSON.parse(await data.text()) as Record<string, unknown>;
    if (raw["conecta"] || raw["interactivo"]) {
      for (const a of ACCOUNTS) all[a] = { ...empty(), ...((raw[a] as Partial<Stored>) ?? {}) };
    } else {
      all.conecta = { ...empty(), ...(raw as Partial<Stored>) };
    }
  } catch { /* arquivo inválido */ }
  return all;
}

export async function writeAll(db: SupabaseClient, s: All) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await db.storage.createBucket(BUCKET, { public: false });
  const body = new Blob([JSON.stringify(s)], { type: "application/json" });
  const { error } = await db.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw new Error("Não foi possível salvar a configuração.");
}

export async function logActivity(db: SupabaseClient, userId: string | null, name: string | null, label: string, data: Record<string, unknown>, schoolId?: string | null) {
  await db.from("activity_logs").insert({
    actor_id: userId, actor_name: name, action: "update", table_name: "maxbot_settings",
    record_id: "maxbot", school_id: schoolId ?? null, label, new_data: data,
  });
}

export async function maxbotCall(s: Stored, body: Record<string, unknown>) {
  if (!s.token) throw new Error("Nenhum token configurado.");
  const res = await fetch(s.api_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: s.token, ...body }),
  });
  if (!res.ok) throw new Error(`O Maxbot respondeu com erro (${res.status}).`);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) throw new Error("Resposta inválida do Maxbot.");
  if (json["status"] === 0 || json["status"] === "0") throw new Error(`Maxbot: ${String(json["msg"] ?? "falha")}`);
  return json;
}

type Contact = {
  id: string | number; name?: string; surname?: string; email?: string;
  whatsapp?: string; mobile_phone?: string; phone?: string; segmentation?: string[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
const phoneKey = (v: string) => { let d = v.replace(/\D/g, ""); if (d.length >= 12 && d.startsWith("55")) d = d.slice(2); return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d; };

async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await q(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Tudo que já existe no portal (qualquer lista, qualquer etapa): telefones (DDD + 8 últimos dígitos) e códigos.
async function existingPortal(db: SupabaseClient) {
  const phones = new Set<string>();
  const codes = new Set<string>();
  const opps = await fetchAll<{ phone: string | null; name: string | null }>((a, b) => db.from("opportunities").select("phone, name").range(a, b));
  for (const o of opps) {
    if (o.phone) phones.add(phoneKey(o.phone));
    const m = o.name?.match(/\d+\/[A-Za-z]{2}\d{4}/); if (m) codes.add(m[0].toUpperCase());
  }
  const subs = await fetchAll<{ public_id: string | null }>((a, b) => db.from("submissions").select("public_id").range(a, b));
  for (const x of subs) if (x.public_id) codes.add(x.public_id.toUpperCase());
  const fields = await fetchAll<{ id: string; label: string }>((a, b) => db.from("form_fields").select("id, label").range(a, b));
  const ids = fields.filter((f) => /telefone|whats|celular/i.test(f.label)).map((f) => f.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const vals = await fetchAll<{ value: string | null }>((a, b) => db.from("submission_values").select("value").in("field_id", chunk).range(a, b));
    for (const v of vals) if (v.value) phones.add(phoneKey(v.value));
  }
  phones.delete("");
  return { phones, codes };
}

// Busca os contatos do período e cadastra na Lista de LEADS os que têm a etiqueta da unidade.
export async function runImport(db: SupabaseClient, all: All, account: Account): Promise<ImportSummary> {
  const s = all[account];
  const at = new Date().toISOString();
  const map = Object.entries(s.segmentations ?? {}).filter(([, t]) => t);
  if (!s.token) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Nenhum token configurado." };
  if (map.length === 0) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Nenhuma etiqueta vinculada às unidades." };
  if (!s.import_since) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Informe a data inicial." };
  // Contato com etiquetas de várias unidades entra na primeira pela ordem fixa (Centro, Expedicionários, Cristo, Bessa).
  const { data: schoolRows } = await db.from("schools").select("id, name").in("id", map.map(([id]) => id));
  const nameOf = new Map((schoolRows ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
  map.sort((a, b) => compareSchoolNames(nameOf.get(a[0]) ?? "", nameOf.get(b[0]) ?? ""));

  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  // 0 = data de cadastro, 1 = data da última atualização (pega contatos antigos que ganharam a etiqueta)
  for (const focus of ["0", "1"]) {
    for (let page = 1; page <= 200; page++) {
      const json = await maxbotCall(s, {
        cmd: "get_contact", focus_period: focus, date_start: s.import_since, date_stop: today,
        pagination: { per_page: "100", current: String(page) },
      });
      const list = (json["data"] as Contact[] | undefined) ?? [];
      for (const c of list) { const k = String(c.id); if (!seen.has(k)) { seen.add(k); contacts.push(c); } }
      const pag = json["pagination"] as { total_pages?: string | number } | undefined;
      if (list.length < 100 || page >= Number(pag?.total_pages ?? page)) break;
    }
  }

  const imported = (s.imported ??= {});
  const linked = new Set(Object.values(s.contacts ?? {}).map(String));
  const portal = await existingPortal(db);
  let found = 0, done = 0, skipped = 0;
  const formCache = new Map<string, { formId: string; fields: { id: string; label: string; type: string; options: string[] | null }[]; phones: Set<string> } | null>();

  for (const c of contacts) {
    const segs = (c.segmentation ?? []).map(norm);
    const hit = map.find(([, title]) => segs.includes(norm(title)));
    if (!hit) continue;
    found++;
    const cid = String(c.id);
    if (imported[cid]) { skipped++; continue; }
    // Já está no portal (card em qualquer etapa ou ficha em qualquer lista): só a etiqueta é tratada, nada é criado.
    const fullName = [c.name, c.surname].filter(Boolean).join(" ");
    const code = fullName.match(/\d+\/[A-Za-z]{2}\d{4}/)?.[0]?.toUpperCase();
    const pk0 = phoneKey(c.whatsapp || c.mobile_phone || c.phone || "");
    if (linked.has(cid) || (code && portal.codes.has(code)) || (pk0 && portal.phones.has(pk0))) { skipped++; imported[cid] = "existente"; continue; }
    const schoolId = hit[0];

    if (!formCache.has(schoolId)) {
      const { data: forms } = await db.from("forms").select("id, status").eq("school_id", schoolId).eq("list_type", "leads").order("created_at", { ascending: false });
      const form = (forms ?? []).find((f) => f.status === "published") ?? forms?.[0];
      if (!form) { formCache.set(schoolId, null); }
      else {
        const { data: fields } = await db.from("form_fields").select("id, label, type, options").eq("form_id", form.id).eq("internal", false);
        const fl = (fields ?? []) as { id: string; label: string; type: string; options: string[] | null }[];
        const phoneField = fl.find((f) => /telefone|whats|celular/i.test(f.label));
        const phones = new Set<string>();
        if (phoneField) {
          const { data: vals } = await db.from("submission_values").select("value, submissions!inner(school_id, list_type)")
            .eq("field_id", phoneField.id).eq("part", "").eq("submissions.school_id", schoolId).eq("submissions.list_type", "leads");
          for (const v of (vals ?? []) as { value: string | null }[]) if (v.value) phones.add(phoneKey(v.value));
        }
        formCache.set(schoolId, { formId: form.id, fields: fl, phones });
      }
    }
    const info = formCache.get(schoolId);
    if (!info) { skipped++; continue; }

    const rawPhone = c.whatsapp || c.mobile_phone || c.phone || "";
    const pk = phoneKey(rawPhone);
    if (pk && info.phones.has(pk)) { skipped++; imported[cid] = "existente"; continue; }

    const name = [c.name, c.surname].filter(Boolean).join(" ").trim() || "Contato Maxbot";
    const values: Record<string, string> = {};
    for (const f of info.fields) {
      const l = f.label.toLowerCase();
      if (/^nome/.test(l)) values[f.id] = name;
      else if (/telefone|whats|celular/.test(l) && rawPhone) values[f.id] = formatPhone(rawPhone);
      else if (/e-?mail/.test(l) && c.email) values[f.id] = c.email;
      else if (/origem/.test(l)) values[f.id] = f.options?.find((o) => /whats/i.test(o)) ?? "WhatsApp";
    }

    const { data: publicId, error: idErr } = await db.rpc("next_school_lead_id", { p_school_id: schoolId });
    if (idErr || !publicId) throw new Error("Falha ao gerar o ID do lead.");
    const { data: sub, error: subErr } = await db.from("submissions")
      .insert({ form_id: info.formId, school_id: schoolId, public_id: publicId, list_type: "leads" })
      .select("id").single();
    if (subErr) throw new Error(subErr.message);
    const rows = Object.entries(values).map(([field_id, value]) => ({ submission_id: sub.id, field_id, part: "", value }));
    if (rows.length) await db.from("submission_values").insert(rows);
    try {
      const { applyDestination } = await import("./destino.server");
      await applyDestination(db, { submissionId: sub.id, formId: info.formId, schoolId, publicId: publicId as string, values });
    } catch { /* cadastro salvo mesmo sem destino */ }
    imported[cid] = sub.id;
    if (pk) { info.phones.add(pk); portal.phones.add(pk); }
    portal.codes.add(String(publicId).toUpperCase());
    done++;
    await logActivity(db, null, ACCOUNT_LABEL[account], `Lead importado do Maxbot: ${publicId} ${name}`, { contato_maxbot: cid, etiqueta: hit[1] }, schoolId);
  }

  return { at, ok: true, found, imported: done, skipped, message: done ? `${done} lead(s) importado(s).` : "Nenhum lead novo." };
}

// Executa a importação de uma conta e grava o resumo (relê o arquivo para não perder alterações).
// overrides permite rodar com a etiqueta/data que estão na tela, sem salvar antes.
export async function importAccount(
  db: SupabaseClient,
  account: Account,
  overrides?: { segmentations?: Record<string, string> | undefined; import_since?: string | null },
): Promise<ImportSummary> {
  const all = await readAll(db);
  if (overrides) {
    const patch: Partial<Stored> = {};
    if (overrides.segmentations) {
      patch.segmentations = Object.fromEntries(Object.entries(overrides.segmentations).filter(([, t]) => t.trim()));
    }
    if (overrides.import_since !== undefined) patch.import_since = overrides.import_since;
    all[account] = { ...all[account], ...patch };
  }
  let summary: ImportSummary;
  try {
    summary = await runImport(db, all, account);
  } catch (e) {
    console.error("maxbot import", e);
    summary = { at: new Date().toISOString(), ok: false, found: 0, imported: 0, skipped: 0, message: e instanceof Error ? e.message : "Falha na importação." };
  }
  const fresh = await readAll(db);
  fresh[account] = { ...fresh[account], imported: { ...(fresh[account].imported ?? {}), ...(all[account].imported ?? {}) }, last_import: summary };
  await writeAll(db, fresh);
  return summary;
}

export type MaxbotAttendant = { id: string; name: string; active: boolean };
export async function listAttendants(s: Stored): Promise<MaxbotAttendant[]> {
  const json = await maxbotCall(s, { cmd: "get_attendant" });
  const list = (json["attendant"] as { id: number; name: string; status: number | string }[] | undefined) ?? [];
  return list
    .map((a) => ({ id: String(a.id), name: a.name, active: String(a.status) === "1" }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// ===== Contato do card no Maxbot =====
export const toMaxbotPhone = (v: string | null | undefined) => {
  let d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return `55${d}`;
};

export async function accountForSchool(db: SupabaseClient, schoolId: string): Promise<Account | null> {
  const { data } = await db.from("schools").select("brand").eq("id", schoolId).maybeSingle();
  const b = (data as { brand: string | null } | null)?.brand;
  return b === "conecta" || b === "interactivo" ? b : null;
}

export async function findContactByPhone(s: Stored, phone: string): Promise<string | null> {
  // O WhatsApp costuma guardar o celular sem o 9 extra: testa as duas formas.
  const variants = [phone];
  if (phone.length === 13 && phone[4] === "9") variants.push(phone.slice(0, 4) + phone.slice(5));
  else if (phone.length === 12 && /[6-9]/.test(phone[4] ?? "")) variants.push(phone.slice(0, 4) + "9" + phone.slice(4));
  for (const v of variants) for (const key of ["whatsapp", "mobile_phone"]) {
    try {
      const json = await maxbotCall(s, { cmd: "get_contact", [key]: v, pagination: { per_page: "1", current: "1" } });
      const c = ((json["data"] as Contact[] | undefined) ?? [])[0];
      if (c?.id) return String(c.id);
    } catch { /* nenhum registro */ }
  }
  return null;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { name: (parts[0] ?? "Contato").slice(0, 45), surname: parts.slice(1).join(" ").slice(0, 45) };
}

// Nome no padrão "Fulano de Tal (1050/CE2027)", sem duplicar o código.
export function cleanName(name: string) {
  return name.replace(/^\s*\S+\/\S+\s*([·\-–]\s*|$)/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function nameWithCode(name: string, code: string | null | undefined) {
  const base = name.replace(/^\s*\S+\/\S+\s*[·\-–]\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || "Contato";
  return code ? `${base} (${code})` : base;
}

async function oppCode(db: SupabaseClient, submissionId: string | null | undefined): Promise<string | null> {
  if (!submissionId) return null;
  const { data } = await db.from("submissions").select("public_id").eq("id", submissionId).maybeSingle();
  return (data?.public_id as string | null) ?? null;
}

// Atualiza o nome do contato no Maxbot com o código da ficha (uma vez por contato/código).
async function ensureContactName(db: SupabaseClient, account: Account, contactId: string, opp: Opp) {
  try {
    const code = await oppCode(db, opp.submission_id);
    if (!code) return;
    const all = await readAll(db);
    const st = all[account];
    if (st.named?.[contactId] === code) return;
    let name: string | null = cleanName(opp.display_name || opp.name || "") || null;
    if (!name) name = (await submissionContact(db, opp.submission_id)).name;
    if (!name) return;
    const full = nameWithCode(name, code);
    await maxbotCall(st, { cmd: "set_contact", for_contact_id: contactId, ...splitName(full.length > 90 ? full.slice(-90) : full) });
    const fresh = await readAll(db);
    fresh[account] = { ...fresh[account], named: { ...(fresh[account].named ?? {}), [contactId]: code } };
    await writeAll(db, fresh);
  } catch (e) { console.error("maxbot set_contact", contactId, e); }
}

// Acrescenta no contato a etiqueta da unidade do card (sem remover as outras).
const segCache = new Map<string, { at: number; list: { id: string | number; title: string }[] }>();
const missingLogged = new Set<string>();
export async function missingSegmentations(s: Stored): Promise<string[]> {
  if (!s.token) return [];
  const json = await maxbotCall(s, { cmd: "get_segmentation" });
  const titles = new Set(((json["segmentation"] as { title: string }[] | undefined) ?? []).map((x) => norm(x.title ?? "")));
  return Object.entries(s.segmentations ?? {}).filter(([, t]) => t && !titles.has(norm(t))).map(([id]) => id);
}
async function ensureContactSegmentation(db: SupabaseClient, account: Account, contactId: string, schoolId: string) {
  try {
    const st = (await readAll(db))[account];
    const title = st.segmentations?.[schoolId];
    if (!title || !st.token) return;
    if (st.tagged?.[contactId]?.includes(schoolId)) return;
    let c = segCache.get(account);
    if (!c || Date.now() - c.at > 600_000) {
      const json = await maxbotCall(st, { cmd: "get_segmentation" });
      c = { at: Date.now(), list: (json["segmentation"] as { id: string | number; title: string }[] | undefined) ?? [] };
      segCache.set(account, c);
    }
    const seg = c.list.find((x) => norm(x.title ?? "") === norm(title));
    if (!seg) {
      const k = `${account}:${schoolId}`;
      if (!missingLogged.has(k)) { missingLogged.add(k); await logActivity(db, null, ACCOUNT_LABEL[account], `Etiqueta "${title}" não encontrada no Maxbot`, { etiqueta: title }, schoolId); }
      return;
    }
    await maxbotCall(st, { cmd: "add_contact_segmentation", contact_id: contactId, segmentation_ids: String(seg.id) });
    const fresh = await readAll(db);
    const prev = fresh[account].tagged ?? {};
    fresh[account] = { ...fresh[account], tagged: { ...prev, [contactId]: [...(prev[contactId] ?? []), schoolId] } };
    await writeAll(db, fresh);
    await logActivity(db, null, ACCOUNT_LABEL[account], `Etiqueta "${title}" adicionada ao contato ${contactId}`, { contato_maxbot: contactId, etiqueta: title }, schoolId);
  } catch (e) { console.error("maxbot add_contact_segmentation", contactId, e); }
}

export async function createContact(s: Stored, name: string, phone: string, email?: string | null): Promise<string> {
  const parts = name.trim().split(/\s+/);
  const json = await maxbotCall(s, {
    cmd: "put_contact", name: (parts[0] ?? "Contato").slice(0, 45), surname: parts.slice(1).join(" ").slice(0, 45),
    whatsapp: phone, mobile_phone: phone, ...(email ? { email: email.slice(0, 45) } : {}),
  });
  if (!json["contact_id"]) throw new Error("Maxbot não retornou o ID do contato.");
  return String(json["contact_id"]);
}

type Opp = { id: string; school_id: string; name?: string | null; display_name?: string | null; phone: string | null; email: string | null; submission_id?: string | null };

// Nome e telefone da ficha (submission_values), usados quando o card não os tem.
export async function submissionContact(db: SupabaseClient, submissionId: string | null | undefined) {
  const out: { name: string | null; phone: string | null } = { name: null, phone: null };
  if (!submissionId) return out;
  const { data } = await db.from("submission_values").select("value, form_fields!inner(label)")
    .eq("submission_id", submissionId).eq("part", "");
  for (const v of (data ?? []) as unknown as { value: string | null; form_fields: { label: string } | { label: string }[] }[]) {
    const f = Array.isArray(v.form_fields) ? v.form_fields[0] : v.form_fields;
    if (!v.value || !f) continue;
    if (!out.phone && /telefone|whats|celular/i.test(f.label)) out.phone = v.value;
    else if (!out.name && /nome/i.test(f.label) && !/respons|m[aã]e|pai/i.test(f.label)) out.name = v.value;
  }
  return out;
}

// Garante o cadastro do card no Maxbot. Retorna o status e grava o vínculo no arquivo.
export async function ensureOpportunityContact(
  db: SupabaseClient, opp: Opp, opts: { register: boolean; actor?: string | null },
): Promise<{ status: "linked" | "missing" | "no_phone" | "not_configured"; contactId: string | null; created?: boolean; account: Account | null }> {
  const account = await accountForSchool(db, opp.school_id);
  if (!account) return { status: "not_configured", contactId: null, account };
  const all = await readAll(db);
  const s = all[account];
  if (!s.token) return { status: "not_configured", contactId: null, account };
  const saved = s.contacts?.[opp.id];
  if (saved) { await ensureContactName(db, account, saved, opp); await ensureContactSegmentation(db, account, saved, opp.school_id); return { status: "linked", contactId: saved, account }; }
  // Lead importado do Maxbot: o contato de origem já é conhecido.
  if (opp.submission_id) {
    const hit = Object.entries(s.imported ?? {}).find(([, sid]) => sid === opp.submission_id);
    if (hit) {
      const fresh = await readAll(db);
      fresh[account] = { ...fresh[account], contacts: { ...(fresh[account].contacts ?? {}), [opp.id]: hit[0] } };
      await writeAll(db, fresh);
      await ensureContactName(db, account, hit[0], opp);
      await ensureContactSegmentation(db, account, hit[0], opp.school_id);
      return { status: "linked", contactId: hit[0], account };
    }
  }
  if (opp.display_name && !cleanName(opp.display_name)) opp = { ...opp, display_name: null };
  const sc = (!opp.phone || !opp.display_name) ? await submissionContact(db, opp.submission_id) : { name: null, phone: null };
  if (!opp.display_name) opp = { ...opp, display_name: sc.name || cleanName(opp.name ?? "") || null };
  const phone = toMaxbotPhone(opp.phone || sc.phone);
  if (!phone) return { status: "no_phone", contactId: null, account };
  let contactId = await findContactByPhone(s, phone);
  let created = false;
  if (!contactId && opts.register) {
    contactId = await createContact(s, nameWithCode(opp.display_name || "Contato", await oppCode(db, opp.submission_id)), phone, opp.email);
    created = true;
  }
  if (!contactId) return { status: "missing", contactId: null, account };
  const fresh = await readAll(db);
  fresh[account] = { ...fresh[account], contacts: { ...(fresh[account].contacts ?? {}), [opp.id]: contactId } };
  await writeAll(db, fresh);
  await ensureContactName(db, account, contactId, opp);
  await ensureContactSegmentation(db, account, contactId, opp.school_id);
  if (created) {
    await db.from("crm_notes").insert({ opportunity_id: opp.id, author_id: null, author_name: opts.actor || ACCOUNT_LABEL[account], body: `Contato cadastrado no ${ACCOUNT_LABEL[account]} (ID ${contactId}).` });
    await logActivity(db, null, opts.actor || ACCOUNT_LABEL[account], `Contato cadastrado no Maxbot: ${opp.display_name ?? ""}`, { contato_maxbot: contactId, card: opp.id }, opp.school_id);
  }
  return { status: "linked", contactId, created, account };
}

// Varre cards recentes sem vínculo e cadastra no Maxbot (rotina a cada 10 min).
export async function syncRecentOpportunities(db: SupabaseClient, days = 3) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await db.from("opportunities").select("id, school_id, name, phone, email, submission_id").gte("created_at", since).limit(500);
  const all = await readAll(db);
  let done = 0;
  for (const o of (data ?? []) as Opp[]) {
    if (!toMaxbotPhone(o.phone) && !o.submission_id) continue;
    const linkedAcc = ACCOUNTS.find((a) => all[a].contacts?.[o.id]);
    const cid = linkedAcc ? all[linkedAcc].contacts?.[o.id] ?? "" : "";
    const tagDone = !linkedAcc || !all[linkedAcc].segmentations?.[o.school_id] || !!all[linkedAcc].tagged?.[cid]?.includes(o.school_id);
    if (linkedAcc && tagDone && (!o.submission_id || all[linkedAcc].named?.[cid])) continue;
    try { const r = await ensureOpportunityContact(db, o, { register: true }); if (r.status === "linked") done++; }
    catch (e) { console.error("maxbot sync", o.id, e); }
  }
  // Contatos já vinculados (cards antigos) que ainda não têm a etiqueta da unidade.
  const pending: string[] = [];
  for (const a of ACCOUNTS) for (const [oppId, cid] of Object.entries(all[a].contacts ?? {})) pending.push(oppId);
  const seen = new Set(((data ?? []) as Opp[]).map((o) => o.id));
  const ids = pending.filter((id) => !seen.has(id));
  let tagged = 0;
  for (let i = 0; i < ids.length && tagged < 100; i += 200) {
    const { data: olds } = await db.from("opportunities").select("id, school_id, name, phone, email, submission_id").in("id", ids.slice(i, i + 200));
    for (const o of (olds ?? []) as Opp[]) {
      if (tagged >= 100) break;
      const a = ACCOUNTS.find((x) => all[x].contacts?.[o.id])!;
      const cid = all[a].contacts?.[o.id] ?? "";
      if (!cid) continue;
      if (!all[a].segmentations?.[o.school_id] || all[a].tagged?.[cid]?.includes(o.school_id)) continue;
      if (missingLogged.has(`${a}:${o.school_id}`)) continue;
      await ensureContactSegmentation(db, a, cid, o.school_id); tagged++;
    }
  }
  return done;
}

export type MaxbotTemplate = { id: string; title: string; msg: string; category: string; type: "F" | "A" };
export const TEMPLATE_TYPE_LABEL = { F: "Follow-up", A: "Aviso" } as const;
export async function listFollowupTemplates(s: Stored): Promise<MaxbotTemplate[]> {
  const json = await maxbotCall(s, { cmd: "get_template" });
  const list = ((json["template"] as { id: number; type?: string; title: string; msg: string; category_title?: string }[] | undefined) ?? [])
    // só WABA, e só Follow-up (F) ou Aviso (A): templates de Chat não podem ser disparados pela API
    .filter((t) => (t.category_title ?? "").toUpperCase().includes("WABA") && (t.type === "F" || t.type === "A"));
  return list.map((t) => ({ id: String(t.id), title: t.title, msg: t.msg ?? "", category: t.category_title ?? "", type: t.type as "F" | "A" }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export async function attendantSector(s: Stored, attendantId: string): Promise<string | null> {
  const json = await maxbotCall(s, { cmd: "get_attendant" });
  const list = (json["attendant"] as { id: number; service_sector_id?: unknown }[] | undefined) ?? [];
  const a = list.find((x) => String(x.id) === attendantId);
  const sec = a?.service_sector_id;
  const first = Array.isArray(sec) ? sec[0] : typeof sec === "string" ? sec.split(",")[0] : sec;
  const v = first && typeof first === "object" ? (first as { id?: unknown }).id : first;
  return v != null && String(v).trim() ? String(v).trim() : null;
}
