import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

const accountSchema = z.enum(["conecta", "interactivo"]);

async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
}

async function admin() {
  const { extAdmin } = await import("./server");
  return extAdmin();
}

type StoredT = import("./maxbot.server").Stored;

function publicView(s: StoredT) {
  return {
    api_url: s.api_url,
    enabled: s.enabled,
    token_set: Boolean(s.token),
    updated_by_name: s.updated_by_name,
    updated_at: s.updated_at,
    last_test_at: s.last_test_at ?? null,
    last_test_ok: s.last_test_ok ?? null,
    last_test_message: s.last_test_message ?? null,
    segmentations: s.segmentations ?? {},
    import_since: s.import_since ?? null,
    import_enabled: Boolean(s.import_enabled),
    last_import: s.last_import ?? null,
    imported_count: Object.keys(s.imported ?? {}).length,
  };
}

async function actorName(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}

export const getMaxbotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, missingSegmentations } = await import("./maxbot.server");
    const all = await readAll(db);
    const miss = async (a: "conecta" | "interactivo") => { try { return await missingSegmentations(all[a]); } catch { return []; } };
    const [mc, mi] = await Promise.all([miss("conecta"), miss("interactivo")]);
    const { data: schools } = await db.from("schools").select("id, name, brand");
    return {
      conecta: { ...publicView(all.conecta), missing_segmentations: mc },
      interactivo: { ...publicView(all.interactivo), missing_segmentations: mi },
      schools: ((schools ?? []) as { id: string; name: string; brand: string | null }[]),
    };
  });

export const saveMaxbotSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      api_url: z.string().trim().url("Endereço inválido.").max(300),
      enabled: z.boolean(),
      token: z.string().trim().max(500).optional(),
      clear_token: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    const name = await actorName(db, context.userId);
    const tokenChanged = Boolean(data.token) || Boolean(data.clear_token);
    const next: StoredT = {
      ...cur,
      api_url: data.api_url,
      enabled: data.enabled,
      token: data.clear_token ? null : data.token ? data.token : cur.token,
      updated_by: context.userId,
      updated_by_name: name,
      updated_at: new Date().toISOString(),
    };
    if (next.enabled && !next.token) throw new Error("Informe o token antes de ativar a integração.");
    if (!next.token) next.import_enabled = false;
    all[data.account] = next;
    await writeAll(db, all);
    await logActivity(db, context.userId, name, `Configuração ${ACCOUNT_LABEL[data.account]} salva`, {
      api_url: next.api_url, enabled: next.enabled, token: tokenChanged ? (next.token ? "alterado" : "removido") : "sem alteração",
    });
    return publicView(next);
  });

export const testMaxbotConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, maxbotCall, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    if (!cur.token) return { ok: false, message: "Nenhum token configurado." };
    let ok = false;
    let message = "";
    try {
      await maxbotCall(cur, { cmd: "get_service_sector" });
      ok = true;
      message = "Conectado ao Maxbot.";
    } catch (e) {
      message = e instanceof Error ? e.message : "Não foi possível alcançar o Maxbot.";
    }
    const name = await actorName(db, context.userId);
    all[data.account] = { ...cur, last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: message };
    await writeAll(db, all);
    await logActivity(db, context.userId, name, `Teste de conexão ${ACCOUNT_LABEL[data.account]}`, { ok, message });
    return { ok, message };
  });

export const listMaxbotSegmentations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, maxbotCall } = await import("./maxbot.server");
    const all = await readAll(db);
    try {
      const json = await maxbotCall(all[data.account], { cmd: "get_segmentation", type: "0" });
      const list = (json["segmentation"] as { id: number; title: string }[] | undefined) ?? [];
      return { ok: true, error: null as string | null, items: list.map((s) => ({ id: String(s.id), title: s.title })) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Falha ao buscar etiquetas.", items: [] };
    }
  });

export const saveMaxbotImport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      segmentations: z.record(z.string().uuid(), z.string().max(200)),
      import_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable(),
      import_enabled: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    const segs = Object.fromEntries(Object.entries(data.segmentations).filter(([, v]) => v.trim()));
    if (data.import_enabled) {
      if (!cur.token) throw new Error("Salve o token antes de ativar a importação.");
      if (!data.import_since) throw new Error("Informe a data inicial.");
      if (Object.keys(segs).length === 0) throw new Error("Escolha a etiqueta de ao menos uma unidade.");
    }
    all[data.account] = { ...cur, segmentations: segs, import_since: data.import_since, import_enabled: data.import_enabled };
    await writeAll(db, all);
    const name = await actorName(db, context.userId);
    await logActivity(db, context.userId, name, `Importação de LEADS ${ACCOUNT_LABEL[data.account]} configurada`, {
      etiquetas: segs, a_partir_de: data.import_since, automatica: data.import_enabled,
    });
    return { ok: true };
  });

export const runMaxbotImport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      segmentations: z.record(z.string().uuid(), z.string().max(200)).optional(),
      import_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable().optional(),
      test: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { importAccount, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const overrides =
      data.segmentations || data.import_since !== undefined
        ? { segmentations: data.segmentations, import_since: data.import_since ?? null }
        : undefined;
    const summary = await importAccount(db, data.account, overrides);
    if (data.test) {
      const name = await actorName(db, context.userId);
      await logActivity(db, context.userId, name, `Teste de importação de LEADS ${ACCOUNT_LABEL[data.account]}`, {
        ok: summary.ok, found: summary.found, imported: summary.imported, skipped: summary.skipped, message: summary.message,
      });
    }
    return summary;
  });

// ===== Vínculo usuário do Portal ↔ atendente Maxbot =====
export const getMaxbotUserLinks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, listAttendants, ACCOUNTS } = await import("./maxbot.server");
    const all = await readAll(db);
    const out = {} as Record<
      "conecta" | "interactivo",
      { token_set: boolean; error: string | null; attendants: { id: string; name: string; active: boolean }[]; links: Record<string, { id: string; name: string }> }
    >;
    for (const a of ACCOUNTS) {
      const s = all[a];
      let attendants: { id: string; name: string; active: boolean }[] = [];
      let error: string | null = null;
      if (s.token) {
        try { attendants = await listAttendants(s); } catch (e) { error = e instanceof Error ? e.message : "Falha ao buscar atendentes."; }
      }
      out[a] = { token_set: Boolean(s.token), error, attendants, links: s.attendants ?? {} };
    }
    return out;
  });

const linkSchema = z.object({ id: z.string(), name: z.string() }).nullable();
export const saveMaxbotUserLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), conecta: linkSchema.optional(), interactivo: linkSchema.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL, ACCOUNTS } = await import("./maxbot.server");
    const all = await readAll(db);
    const changes: Record<string, unknown> = {};
    for (const a of ACCOUNTS) {
      const v = data[a];
      if (v === undefined) continue;
      const map = { ...(all[a].attendants ?? {}) };
      if (v) {
        const other = Object.entries(map).find(([uid, l]) => l.id === v.id && uid !== data.userId);
        if (other) {
          const { data: p } = await db.from("profiles").select("full_name").eq("id", other[0]).maybeSingle();
          throw new Error(`No ${ACCOUNT_LABEL[a]}, o atendente ${v.name} já está vinculado a ${(p as { full_name: string | null } | null)?.full_name ?? "outro usuário"}.`);
        }
        map[data.userId] = v;
      } else delete map[data.userId];
      all[a] = { ...all[a], attendants: map };
      changes[ACCOUNT_LABEL[a]] = v ? `${v.name} (ID ${v.id})` : "Não vinculado";
    }
    await writeAll(db, all);
    const { data: target } = await db.from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
    const tName = (target as { full_name: string | null } | null)?.full_name ?? data.userId;
    await logActivity(db, context.userId, await actorName(db, context.userId), `Vínculo Maxbot de ${tName}`, changes);
    return { ok: true };
  });

// ===== Maxbot no card do CRM =====
async function loadOpp(context: { supabase: SupabaseClient }, id: string) {
  // RLS: só retorna se o usuário enxerga o cartão.
  const { data, error } = await context.supabase
    .from("opportunities").select("id, school_id, name, phone, email, submission_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem acesso a este cartão.");
  const o = data as { id: string; school_id: string; name: string | null; phone: string | null; email: string | null; submission_id: string | null };
  const { submissionContact } = await import("./maxbot.server");
  const sc = await submissionContact(await admin(), o.submission_id);
  return { ...o, display_name: sc.name || o.name, phone: o.phone || sc.phone };
}

const oppSchema = z.object({ opportunity_id: z.string().uuid() });

export const getCardMaxbotStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const { ensureOpportunityContact, ACCOUNT_LABEL } = await import("./maxbot.server");
    try {
      // Abre o card: se ainda não está no Maxbot, cadastra na hora.
      const r = await ensureOpportunityContact(db, opp, { register: true, actor: await actorName(db, context.userId) });
      return { status: r.status, contact_id: r.contactId, account_label: r.account ? ACCOUNT_LABEL[r.account] : null, error: null as string | null };
    } catch (e) {
      return { status: "error" as const, contact_id: null, account_label: null, error: e instanceof Error ? e.message : "Falha no Maxbot." };
    }
  });

export const listCardMaxbotTemplates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const { readAll, accountForSchool, listFollowupTemplates, ACCOUNT_LABEL } = await import("./maxbot.server");
    const account = await accountForSchool(db, opp.school_id);
    if (!account) throw new Error("Unidade sem conta Maxbot.");
    const all = await readAll(db);
    if (!all[account].token) throw new Error(`${ACCOUNT_LABEL[account]} não está configurado.`);
    const attendant = all[account].attendants?.[context.userId] ?? null;
    const { getPerms } = await import("./server");
    const is_admin = (await getPerms(context.supabase, context.userId)).isAdmin;
    let attendants: { user_id: string; user_name: string; attendant_name: string }[] = [];
    if (is_admin) {
      const map = all[account].attendants ?? {};
      const ids = Object.keys(map);
      const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? ""]));
      attendants = ids.map((id) => ({ user_id: id, user_name: names.get(id) || "Usuário", attendant_name: map[id]?.name ?? "" }))
        .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
    }
    return { account_label: ACCOUNT_LABEL[account], attendant, is_admin, attendants, default_template_id: all[account].default_template?.id ?? null, templates: await listFollowupTemplates(all[account]) };
  });

export const sendCardMaxbotTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.extend({ template_id: z.string().min(1), template_title: z.string().max(200), as_user_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const m = await import("./maxbot.server");
    const name = await actorName(db, context.userId);
    const r = await m.ensureOpportunityContact(db, opp, { register: true, actor: name });
    if (r.status !== "linked" || !r.account || !r.contactId) throw new Error("Contato ainda não está cadastrado no Maxbot.");
    const all = await m.readAll(db);
    const s = all[r.account];
    const def = s.default_template;
    if (!def?.id) throw new Error("Nenhum template padrão definido em Configurações › MAXBOT.");
    const tpl = (await m.listFollowupTemplates(s)).find((t) => t.id === String(def.id));
    if (!tpl) throw new Error("O template padrão não pode ser disparado. Escolha um template de Follow-up ou Aviso em Configurações › MAXBOT.");
    data.template_id = def.id; data.template_title = def.title;
    let senderId = context.userId;
    if (data.as_user_id && data.as_user_id !== context.userId) {
      const { getPerms } = await import("./server");
      if ((await getPerms(context.supabase, context.userId)).isAdmin) senderId = data.as_user_id;
    }
    const att = s.attendants?.[senderId];
    if (!att) throw new Error("Seu usuário não está vinculado a um atendente do Maxbot. Peça ao administrador em Configurações › Usuários.");
    const sector = await m.attendantSector(s, att.id);
    const [first, ...rest] = (opp.display_name ?? "").trim().split(/\s+/);
    const [aFirst, ...aRest] = att.name.trim().split(/\s+/);
    const { maxbotSlot } = await import("./maxbot-slot");
    const payload = (dt: string) => tpl.type === "A" ? ({
      cmd: "send_notice", contact_id: Number(r.contactId), template_id: Number(data.template_id), scheduled: 0, date_time: dt,
      tag_name: first ?? "", tag_last_name: rest.join(" "), tag_atd_name: aFirst ?? "", tag_atd_last_name: aRest.join(" "),
    }) : ({
      cmd: "open_followup", contact_id: Number(r.contactId), template_id: Number(data.template_id),
      attendant_id: Number(att.id), ...(sector ? { sector_id: Number(sector) } : {}), scheduled: 0, date_time: dt,
      tag_name: first ?? "", tag_last_name: rest.join(" "), tag_atd_name: aFirst ?? "", tag_atd_last_name: aRest.join(" "),
    });
    let json: Record<string, unknown>;
    try {
      try {
        json = await m.maxbotCall(s, payload(maxbotSlot()));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/past|passad|date|data|time|hor/i.test(msg) || /minute/i.test(msg) || isBusyError(msg)) throw e;
        json = await m.maxbotCall(s, payload(maxbotSlot(new Date(), 30)));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isBusyError(msg)) throw e;
      const info = await findOpenProtocol(m, s, r.contactId, msg);
      await m.logActivity(db, context.userId, name, `Maxbot: contato em conversa aberta (${opp.display_name ?? ""})`, { erro: msg, protocolo: info.prot_id ?? "", atendente: info.attendant_name ?? "" }, opp.school_id);
      return { ok: false as const, busy: true as const, attendant_name: info.attendant_name, prot_id: info.prot_id, raw: msg, protocol: "" };
    }
    const protocol = String(json["protocol"] ?? json["prot_id"] ?? "");
    await db.from("crm_notes").insert({
      opportunity_id: opp.id, author_id: context.userId, author_name: name ?? "Usuário",
      body: `Template "${data.template_title}" enviado via ${m.ACCOUNT_LABEL[r.account]}${protocol ? ` (protocolo ${protocol})` : ""}${senderId !== context.userId ? ` em nome do atendente ${att.name}` : ""}.`,
    });
    await m.logActivity(db, context.userId, name, `Mensagem Maxbot enviada para ${opp.display_name ?? ""}`, { template: data.template_title, protocolo: protocol, atendente: att.name }, opp.school_id);
    return { ok: true as const, busy: false as const, protocol, attendant_name: null, prot_id: null, raw: "" };
  });

export const listMaxbotTemplatesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, listFollowupTemplates } = await import("./maxbot.server");
    const all = await readAll(db);
    const s = all[data.account];
    return { current: s.default_template?.id ?? "", templates: s.token ? await listFollowupTemplates(s) : [] };
  });

export const saveMaxbotDefaultTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema, id: z.string().max(50), title: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL, listFollowupTemplates } = await import("./maxbot.server");
    const all = await readAll(db);
    if (data.id && !(await listFollowupTemplates(all[data.account])).some((t) => t.id === data.id))
      throw new Error("Esse template não pode ser disparado. Escolha um template de Follow-up ou Aviso.");
    all[data.account] = { ...all[data.account], default_template: data.id ? { id: data.id, title: data.title } : null };
    await writeAll(db, all);
    const name = await actorName(db, context.userId);
    await logActivity(db, context.userId, name, `Template padrão ${ACCOUNT_LABEL[data.account]} definido`, { template: data.title || "Nenhum" });
    return { ok: true };
  });

function isBusyError(msg: string) {
  return /protoc|open|aberto|attendance|atendimento|in service|already|busy|em andamento/i.test(msg) && !/not found|required|minute|template must/i.test(msg);
}

async function findOpenProtocol(m: typeof import("./maxbot.server"), s: Parameters<typeof m.maxbotCall>[0], contactId: string, msg: string) {
  let prot_id: string | null = msg.match(/(?:prot(?:ocol|ocolo)?[^0-9]{0,15})(\d{3,})/i)?.[1] ?? null;
  let attendant_name: string | null = msg.match(/(?:attendant|atendente)[:\s]+([A-Za-zÀ-ú][A-Za-zÀ-ú ]{1,60})/i)?.[1]?.trim() ?? null;
  for (const situation of ["2", "1", ""]) {
    if (prot_id && attendant_name) break;
    try {
      const j = await m.maxbotCall(s, { cmd: "get_prot", contact_id: Number(contactId), ...(situation ? { situation } : {}) });
      const rows = (Array.isArray(j["data"]) ? j["data"] : []) as Record<string, unknown>[];
      const open = rows.find((p) => !/3|fech|clos/i.test(String(p["situation"] ?? p["status"] ?? "")));
      if (open) {
        prot_id ??= String(open["id"] ?? open["prot_id"] ?? "") || null;
        attendant_name ??= String(open["attendant_name"] ?? "") || null;
      }
    } catch { /* ignora */ }
  }
  return { prot_id, attendant_name };
}

export const transferCardMaxbotProtocol = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.extend({ prot_id: z.string().regex(/^\d+$/), as_user_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const m = await import("./maxbot.server");
    const name = await actorName(db, context.userId);
    const account = await m.accountForSchool(db, opp.school_id);
    if (!account) throw new Error("Unidade sem conta Maxbot.");
    const s = (await m.readAll(db))[account];
    let targetId = context.userId;
    if (data.as_user_id && data.as_user_id !== context.userId) {
      const { getPerms } = await import("./server");
      if ((await getPerms(context.supabase, context.userId)).isAdmin) targetId = data.as_user_id;
    }
    const att = s.attendants?.[targetId];
    if (!att) throw new Error("Usuário não vinculado a um atendente do Maxbot.");
    const sector = await m.attendantSector(s, att.id);
    if (!sector) throw new Error("O atendente não tem setor no Maxbot.");
    await m.maxbotCall(s, { cmd: "forward_prot", prot_id: Number(data.prot_id), sector_id: Number(sector), attendant_id: Number(att.id) });
    await db.from("crm_notes").insert({
      opportunity_id: opp.id, author_id: context.userId, author_name: name ?? "Usuário",
      body: `Conversa do Maxbot (protocolo ${data.prot_id}) transferida para o atendente ${att.name}.`,
    });
    await m.logActivity(db, context.userId, name, `Conversa Maxbot transferida (${opp.display_name ?? ""})`, { protocolo: data.prot_id, atendente: att.name }, opp.school_id);
    return { ok: true };
  });
