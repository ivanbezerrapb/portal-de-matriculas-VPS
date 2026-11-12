import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { getPerms } from "./server";

export type TaskType = {
  id: string;
  label: string;
  position: number;
  active: boolean;
  created_at: string;
};

async function requireAdmin(supabase: unknown, userId: string) {
  const perms = await getPerms(supabase as Parameters<typeof getPerms>[0], userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores podem gerenciar atividades.");
}

export const listTaskTypes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ activeOnly: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_task_types")
      .select("*")
      .order("position")
      .order("created_at");
    if (data.activeOnly) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TaskType[];
  });

export const createTaskType = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ label: z.string().trim().min(1).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: last } = await context.supabase
      .from("crm_task_types")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("crm_task_types").insert({
      label: data.label,
      position: ((last?.position as number | undefined) ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTaskType = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(80).optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch["label"] = data.label;
    if (data.active !== undefined) patch["active"] = data.active;
    const { error } = await context.supabase.from("crm_task_types").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveTaskType = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("crm_task_types")
      .select("id, position")
      .order("position")
      .order("created_at");
    const list = (rows ?? []) as { id: string; position: number }[];
    const index = list.findIndex((r) => r.id === data.id);
    const target = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= list.length) return { ok: true };
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    for (let i = 0; i < reordered.length; i++) {
      await context.supabase.from("crm_task_types").update({ position: i }).eq("id", reordered[i]!.id);
    }
    return { ok: true };
  });

export const deleteTaskType = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("crm_task_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
