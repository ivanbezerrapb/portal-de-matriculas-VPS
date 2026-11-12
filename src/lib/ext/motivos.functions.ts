import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { getPerms } from "./server";
import type { CloseReason } from "./model";

async function requireAdmin(supabase: unknown, userId: string) {
  const perms = await getPerms(supabase as Parameters<typeof getPerms>[0], userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores podem gerenciar motivos.");
}

// Leitura para todos os autenticados (RLS permite SELECT).
export const listCloseReasons = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ activeOnly: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_close_reasons")
      .select("*")
      .order("kind")
      .order("position")
      .order("created_at");
    if (data.activeOnly) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CloseReason[];
  });

const reasonFields = z.object({
  kind: z.enum(["won", "lost"]),
  label: z.string().min(1),
});

export const createCloseReason = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => reasonFields.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: last } = await context.supabase
      .from("crm_close_reasons")
      .select("position")
      .eq("kind", data.kind)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("crm_close_reasons").insert({
      kind: data.kind,
      label: data.label.trim(),
      position: ((last?.position as number | undefined) ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCloseReason = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch["label"] = data.label.trim();
    if (data.active !== undefined) patch["active"] = data.active;
    const { error } = await context.supabase
      .from("crm_close_reasons")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveCloseReason = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: current } = await context.supabase
      .from("crm_close_reasons")
      .select("id, kind, position")
      .eq("id", data.id)
      .single();
    if (!current) throw new Error("Motivo não encontrado.");
    const { data: rows } = await context.supabase
      .from("crm_close_reasons")
      .select("id, position")
      .eq("kind", current.kind)
      .order("position");
    const list = (rows ?? []) as { id: string; position: number }[];
    const index = list.findIndex((r) => r.id === data.id);
    const target = data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= list.length) return { ok: true };
    const a = list[index]!;
    const b = list[target]!;
    await context.supabase
      .from("crm_close_reasons")
      .update({ position: b.position })
      .eq("id", a.id);
    await context.supabase
      .from("crm_close_reasons")
      .update({ position: a.position })
      .eq("id", b.id);
    return { ok: true };
  });

export const deleteCloseReason = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("crm_close_reasons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
