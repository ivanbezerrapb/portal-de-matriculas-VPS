import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

// Relatórios: Admin, Direção e Gerentes (Gerente só nas suas unidades).

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function parseSeries(value: string, children: boolean): string[] {
  try {
    const p = JSON.parse(value) as unknown;
    if (Array.isArray(p)) {
      return p.map((x) => String(children ? (x as { serie?: unknown })?.serie ?? "" : x).trim()).filter(Boolean);
    }
  } catch { /* texto simples */ }
  return children ? [] : [value.trim()].filter(Boolean);
}

async function fetchValues(db: any, submissionIds: string[], fieldIds: string[]) {
  const out: { submission_id: string; field_id: string; value: string | null }[] = [];
  if (!submissionIds.length || !fieldIds.length) return out;
  for (let i = 0; i < submissionIds.length; i += 150) {
    const chunk = submissionIds.slice(i, i + 150);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("submission_values").select("submission_id, field_id, value")
        .eq("part", "").in("submission_id", chunk).in("field_id", fieldIds)
        .order("submission_id").order("field_id").range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function scope(context: { supabase: any; userId: string }, schoolId?: string) {
  const { getPerms, extAdmin } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  const admin = extAdmin();
  const all = perms.isAdmin || perms.isDirecao;
  if (!all && perms.managerSchools.length === 0) throw new Error("Sem permissão para ver relatórios.");
  const { data: schools } = await admin.from("schools").select("id, name");
  const allowed = ((schools ?? []) as { id: string; name: string }[]).filter((s) => all || perms.managerSchools.includes(s.id));
  const ids = schoolId ? allowed.filter((s) => s.id === schoolId).map((s) => s.id) : allowed.map((s) => s.id);
  return { admin, schools: allowed, schoolIds: ids, schoolName: new Map(allowed.map((s) => [s.id, s.name])) };
}

async function sharedFields(admin: any, formIds: string[]) {
  if (!formIds.length) return { nameField: new Map<string, string>(), fields: [] as any[] };
  const { data: ff } = await admin.from("form_fields").select("id, form_id, label, type, position").in("form_id", formIds).order("position");
  const fields = (ff ?? []) as { id: string; form_id: string; label: string; type: string }[];
  const nameField = new Map<string, string>();
  for (const f of fields) if (!nameField.has(f.form_id) && norm(f.label) === "nome do responsavel") nameField.set(f.form_id, f.id);
  for (const f of fields) if (!nameField.has(f.form_id) && f.type === "short_text") nameField.set(f.form_id, f.id);
  return { nameField, fields };
}

const isSeriesField = (f: { label: string; type: string }) => {
  const l = norm(f.label);
  return f.type === "children" || l === "serie" || l === "series" || l.includes("serie de interesse");
};
const isRestrictionField = (f: { label: string }) => {
  const l = norm(f.label);
  return l.includes("acompanhamento") && (l.includes("medico") || l.includes("psicolog") || l.includes("psicopedag"));
};

export const reportOptions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { admin, schools, schoolIds } = await scope(context);
    const { data: funnels } = schoolIds.length
      ? await admin.from("funnels").select("id, name, school_id").in("school_id", schoolIds).order("name")
      : { data: [] };
    return { schools, funnels: (funnels ?? []) as { id: string; name: string; school_id: string }[] };
  });

export const enrolledReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, schoolIds, schoolName } = await scope(context, data.school_id);
    if (!schoolIds.length) return [];
    const subs = await fetchAll<any>((a, b) => {
      let q = admin.from("submissions")
        .select("id, public_id, form_id, school_id, children_count, enrollment_count, enrolled_at, enrolled_by, created_at, enroller:presenters!submissions_enroller_id_fkey(name)")
        .eq("list_type", "visitantes").eq("enrolled", true).in("school_id", schoolIds);
      if (data.from) q = q.gte("enrolled_at", data.from);
      if (data.to) q = q.lte("enrolled_at", `${data.to}T23:59:59`);
      return q.order("enrolled_at", { ascending: false, nullsFirst: false }).range(a, b);
    });
    const { nameField, fields } = await sharedFields(admin, [...new Set(subs.map((s) => s.form_id as string))]);
    const seriesFields = fields.filter(isSeriesField);
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    const vals = await fetchValues(admin, subs.map((s) => s.id), [...new Set([...nameField.values(), ...seriesFields.map((f) => f.id)])]);
    const names = new Map<string, string>();
    const series = new Map<string, string[]>();
    for (const v of vals) {
      const f = fieldById.get(v.field_id);
      if (!f || !v.value) continue;
      if (nameField.get(f.form_id) === f.id && f.type !== "children") names.set(v.submission_id, v.value.trim());
      if (isSeriesField(f)) series.set(v.submission_id, [...(series.get(v.submission_id) ?? []), ...parseSeries(v.value, f.type === "children")]);
    }
    const byIds = [...new Set(subs.map((s) => s.enrolled_by).filter(Boolean))];
    const { data: profs } = byIds.length ? await admin.from("profiles").select("id, full_name").in("id", byIds) : { data: [] };
    const profName = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? ""]));
    return subs.map((s) => ({
      id: s.id as string,
      public_id: (s.public_id ?? "") as string,
      school: schoolName.get(s.school_id) ?? "",
      responsible: names.get(s.id) ?? "",
      children: (s.children_count ?? null) as number | null,
      series: [...new Set(series.get(s.id) ?? [])],
      count: Number(s.enrollment_count ?? 0),
      enrolled_at: (s.enrolled_at ?? null) as string | null,
      enrolled_by: (s.enrolled_by ? profName.get(s.enrolled_by) : "") || (s.enroller?.name ?? ""),
    }));
  });

export const attendanceReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ school_id: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, schoolIds, schoolName } = await scope(context, data.school_id);
    if (!schoolIds.length) return [];
    const opps = await fetchAll<any>((a, b) => {
      let q = admin.from("opportunities")
        .select("id, name, school_id, funnel_id, stage_id, owner_id, status, created_at, submission_id, funnels(name), funnel_stages(name), submissions(form_id)")
        .in("school_id", schoolIds);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
      return q.order("created_at", { ascending: false }).range(a, b);
    });
    const ids = opps.map((o) => o.id as string);
    const tasks: { opportunity_id: string; done: boolean; due_date: string | null }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      tasks.push(...await fetchAll<any>((a, b) => admin.from("crm_tasks").select("opportunity_id, done, due_date").in("opportunity_id", chunk).range(a, b)));
    }
    const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const overdue = new Map<string, number>();
    for (const t of tasks) if (!t.done && t.due_date && t.due_date.slice(0, 10) < today) overdue.set(t.opportunity_id, (overdue.get(t.opportunity_id) ?? 0) + 1);

    const formIds = [...new Set(opps.map((o) => o.submissions?.form_id).filter(Boolean))] as string[];
    const { fields } = await sharedFields(admin, formIds);
    const restrictionIds = fields.filter(isRestrictionField).map((f) => f.id);
    const vals = await fetchValues(admin, opps.map((o) => o.submission_id).filter(Boolean), restrictionIds);
    const restricted = new Set(vals.filter((v) => norm(v.value ?? "") === "sim").map((v) => v.submission_id));

    const ownerIds = [...new Set(opps.map((o) => o.owner_id).filter(Boolean))];
    const { data: profs } = ownerIds.length ? await admin.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [] };
    const profName = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? ""]));
    return opps.map((o) => ({
      id: o.id as string,
      client: String(o.name ?? ""),
      school: schoolName.get(o.school_id) ?? "",
      funnel_id: o.funnel_id as string,
      funnel: (o.funnels?.name ?? "") as string,
      stage: (o.funnel_stages?.name ?? "") as string,
      owner_id: (o.owner_id ?? null) as string | null,
      attendant: o.owner_id ? profName.get(o.owner_id) ?? "" : "",
      status: o.status as "open" | "won" | "lost",
      created_at: o.created_at as string,
      restricted: Boolean(o.submission_id && restricted.has(o.submission_id)),
      overdue: overdue.get(o.id) ?? 0,
    }));
  });
