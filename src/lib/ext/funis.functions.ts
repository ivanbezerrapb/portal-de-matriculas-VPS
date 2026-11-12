import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { funnelListType, type Funnel, type FunnelKind, type FunnelStage, type StageKind } from "./model";

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores.");
  return perms;
}

type DefaultStage = { name: string; color: string; kind: StageKind | null };

// Etapas criadas com cada novo funil, conforme o tipo.
const DEFAULT_STAGES: Record<FunnelKind, DefaultStage[]> = {
  leads: [
    { name: "Novo contato", color: "#1e40af", kind: null },
    { name: "Em atendimento", color: "#0284c7", kind: null },
    { name: "Visita agendada", color: "#d97706", kind: "visita_agendada" },
    { name: "Reagendar visita", color: "#7c3aed", kind: "reagendar_visita" },
    { name: "Visita realizada", color: "#059669", kind: "visita_realizada" },
    { name: "Perdido", color: "#dc2626", kind: null },
  ],
  visitantes: [
    { name: "Novo contato", color: "#1e40af", kind: null },
    { name: "Em atendimento", color: "#0284c7", kind: null },
    { name: "Matrícula agendada", color: "#d97706", kind: "matricula_agendada" },
    { name: "Reagendar matrícula", color: "#7c3aed", kind: "reagendar_matricula" },
    { name: "Matriculado", color: "#059669", kind: "matriculado" },
    { name: "Perdido", color: "#dc2626", kind: null },
  ],
};

const FUNNEL_KINDS = ["leads", "visitantes"] as const;
const STAGE_KINDS = [
  "visita_agendada",
  "reagendar_visita",
  "visita_realizada",
  "matricula_agendada",
  "reagendar_matricula",
  "matriculado",
] as const;

// Traduz o erro do índice único (um tipo de etapa por funil).
function stageError(message: string): Error {
  if (/funnel_stages_funnel_kind_uniq|duplicate key/i.test(message))
    return new Error("Já existe outra etapa deste tipo neste funil.");
  return new Error(message);
}

export const listFunnels = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const [{ data: funnels, error }, { data: schools, error: schoolsError }] = await Promise.all([
      context.supabase.from("funnels").select("*").order("created_at"),
      context.supabase.from("schools").select("id, name"),
    ]);
    if (error) throw new Error(error.message);
    if (schoolsError) throw new Error(schoolsError.message);
    const schoolName = new Map(
      (schools ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );
    // Funis ordenados pela unidade e depois pelo nome do funil.
    (funnels ?? []).sort((a: Funnel, b: Funnel) => {
      const an = schoolName.get(a.school_id) ?? "";
      const bn = schoolName.get(b.school_id) ?? "";
      return (
        an.localeCompare(bn, "pt", { sensitivity: "base" }) ||
        a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
      );
    });
    const ids = (funnels ?? []).map((f: { id: string }) => f.id);
    let stages: FunnelStage[] = [];
    if (ids.length) {
      const { data, error: stagesError } = await context.supabase
        .from("funnel_stages")
        .select("*")
        .in("funnel_id", ids)
        .order("position");
      if (stagesError) throw new Error(stagesError.message);
      stages = (data ?? []) as FunnelStage[];
    }
    return { funnels: (funnels ?? []) as Funnel[], stages };
  });

const funnelInput = z.object({
  school_id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
  kind: z.enum(FUNNEL_KINDS).optional(),
});

// Garante um único funil padrão por escola.
async function clearDefault(supabase: SupabaseClient, schoolId: string, keepId?: string) {
  let query = supabase.from("funnels").update({ is_default: false }).eq("school_id", schoolId);
  if (keepId) query = query.neq("id", keepId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function schoolHasFunnel(supabase: SupabaseClient, schoolId: string) {
  const { data } = await supabase
    .from("funnels")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export const createFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => funnelInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const first = !(await schoolHasFunnel(context.supabase, data.school_id));
    const isDefault = data.is_default || first;
    if (isDefault) await clearDefault(context.supabase, data.school_id);
    const { data: created, error } = await context.supabase
      .from("funnels")
      .insert({
        school_id: data.school_id,
        name: data.name,
        description: data.description || null,
        is_default: isDefault,
        kind: data.kind ?? funnelListType(data.name),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const kind: FunnelKind = data.kind ?? funnelListType(data.name);
    const { error: stagesError } = await context.supabase.from("funnel_stages").insert(
      DEFAULT_STAGES[kind].map((s, i) => ({
        funnel_id: created.id,
        name: s.name,
        color: s.color,
        kind: s.kind,
        position: i,
      })),
    );
    if (stagesError) throw new Error(stagesError.message);
    return created;
  });

export const updateFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).merge(funnelInput).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.is_default) await clearDefault(context.supabase, data.school_id, data.id);
    const { error } = await context.supabase
      .from("funnels")
      .update({
        school_id: data.school_id,
        name: data.name,
        description: data.description || null,
        ...(data.is_default === undefined ? {} : { is_default: data.is_default }),
        ...(data.kind === undefined ? {} : { kind: data.kind }),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: original, error } = await context.supabase
      .from("funnels")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: copy, error: copyError } = await context.supabase
      .from("funnels")
      .insert({
        school_id: original.school_id,
        name: `${original.name} (cópia)`,
        description: original.description,
        kind: original.kind ?? funnelListType(original.name),
      })
      .select()
      .single();
    if (copyError) throw new Error(copyError.message);
    const { data: stages } = await context.supabase
      .from("funnel_stages")
      .select("name, description, color, position, kind")
      .eq("funnel_id", data.id)
      .order("position");
    if (stages?.length) {
      const { error: insertError } = await context.supabase
        .from("funnel_stages")
        .insert(stages.map((s) => ({ ...s, funnel_id: copy.id })));
      if (insertError) throw new Error(insertError.message);
    }
    return copy;
  });

export const deleteFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("funnels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const stageFields = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().min(4).max(9),
  kind: z.enum(STAGE_KINDS).nullable().optional(),
});

export const createStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ funnel_id: z.string().uuid() }).merge(stageFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: last } = await context.supabase
      .from("funnel_stages")
      .select("position")
      .eq("funnel_id", data.funnel_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("funnel_stages").insert({
      funnel_id: data.funnel_id,
      name: data.name,
      description: data.description || null,
      color: data.color,
      kind: data.kind ?? null,
      position: (last?.position ?? -1) + 1,
    });
    if (error) throw stageError(error.message);
    return { ok: true };
  });

export const updateStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).merge(stageFields).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("funnel_stages")
      .update({
        name: data.name,
        description: data.description || null,
        color: data.color,
        ...(data.kind === undefined ? {} : { kind: data.kind }),
      })
      .eq("id", data.id);
    if (error) throw stageError(error.message);
    return { ok: true };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("funnel_stages")
        .update({ position: i })
        .eq("id", data.ids[i])
        .eq("funnel_id", data.funnel_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("funnel_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Responsáveis (Central de Informações) vinculados a cada funil.
export const listFunnelOwners = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: visibleFunnels, error: visibleError } = await context.supabase
      .from("funnels")
      .select("id");
    if (visibleError) throw new Error(visibleError.message);
    const visibleIds = (visibleFunnels ?? []).map((f: { id: string }) => f.id);
    if (!visibleIds.length) {
      return [] as { funnel_id: string; user_id: string; name: string }[];
    }
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { data: links, error } = await admin
      .from("user_funnels")
      .select("user_id, funnel_id")
      .in("funnel_id", visibleIds);
    if (error) throw new Error(error.message);
    const rows = (links ?? []) as { user_id: string; funnel_id: string }[];
    if (!rows.length) return [] as { funnel_id: string; user_id: string; name: string }[];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(rows.map((r) => r.user_id))]);
    const names = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
        p.id,
        p.full_name ?? "",
      ]),
    );
    return rows.map((r) => ({
      funnel_id: r.funnel_id,
      user_id: r.user_id,
      name: names.get(r.user_id) || "Sem nome",
    }));
  });
