import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export const PRESENTER_KINDS = ["secretaria", "coordenacao", "efetivacao"] as const;
export type PresenterKind = (typeof PRESENTER_KINDS)[number];

export const PRESENTER_KIND_LABELS: Record<PresenterKind, string> = {
  secretaria: "Secretaria (quem atendeu)",
  coordenacao: "Coordenação (quem apresentou)",
  efetivacao: "Efetivação (quem efetivou)",
};

export type Presenter = {
  id: string;
  school_id: string;
  kind: PresenterKind;
  name: string;
  active: boolean;
  created_at: string;
};

const kindSchema = z.enum(PRESENTER_KINDS);

export const listPresenters = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        school_id: z.string().uuid().optional(),
        kind: kindSchema.optional(),
        only_active: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("presenters").select("*").order("name");
    if (data.school_id) query = query.eq("school_id", data.school_id);
    if (data.kind) query = query.eq("kind", data.kind);
    if (data.only_active) query = query.eq("active", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Presenter[];
  });

async function assertCanManage(
  supabase: Parameters<typeof import("./server").getPerms>[0],
  userId: string,
  schoolId: string,
) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (
    !perms.isAdmin &&
    !perms.managerSchools.includes(schoolId) &&
    !perms.operatorSchools.includes(schoolId)
  ) {
    throw new Error("Você não tem permissão para gerenciar os nomes desta unidade.");
  }
}

export const createPresenter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        school_id: z.string().uuid(),
        kind: kindSchema,
        name: z.string().trim().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId, data.school_id);
    const { data: created, error } = await context.supabase
      .from("presenters")
      .insert({ school_id: data.school_id, kind: data.kind, name: data.name.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Este nome já está cadastrado nesta unidade.");
      throw new Error(error.message);
    }
    return created as Presenter;
  });

export const updatePresenter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(120).optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: readError } = await context.supabase
      .from("presenters")
      .select("id, school_id")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    await assertCanManage(context.supabase, context.userId, row.school_id);

    const patch: Record<string, unknown> = {};
    if (data.name != null) patch["name"] = data.name.trim();
    if (data.active != null) patch["active"] = data.active;
    const { error } = await context.supabase.from("presenters").update(patch).eq("id", data.id);
    if (error) {
      if (error.code === "23505") throw new Error("Este nome já está cadastrado nesta unidade.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePresenter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error: readError } = await context.supabase
      .from("presenters")
      .select("id, school_id")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);
    await assertCanManage(context.supabase, context.userId, row.school_id);
    const { error } = await context.supabase.from("presenters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
