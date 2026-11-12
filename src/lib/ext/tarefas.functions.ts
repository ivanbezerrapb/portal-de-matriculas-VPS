import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { CrmTask } from "./model";

export type TaskRow = CrmTask & {
  opportunities: {
    id: string;
    name: string;
    school_id: string;
    funnel_id: string;
    owner_id: string | null;
    funnels: { name: string } | null;
    schools: { name: string } | null;
    owner: { id: string; full_name: string | null } | null;
  } | null;
};

// Lista tarefas; sem filtro de oportunidade devolve as de todas as
// oportunidades visíveis para o usuário (RLS cuida do escopo).
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        opportunity_id: z.string().uuid().optional(),
        done: z.boolean().optional(),
        school_id: z.string().uuid().optional(),
        funnel_id: z.string().uuid().optional(),
        owner_id: z.string().uuid().optional(),
        unassigned: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_tasks")
      .select(
        "*, opportunities!inner(id, name, school_id, funnel_id, owner_id, funnels(name), schools(name))",
      )
      .order("done")
      .order("due_date", { nullsFirst: false })
      .order("created_at");
    if (data.opportunity_id) q = q.eq("opportunity_id", data.opportunity_id);
    if (data.done !== undefined) q = q.eq("done", data.done);
    if (data.school_id) q = q.eq("opportunities.school_id", data.school_id);
    if (data.funnel_id) q = q.eq("opportunities.funnel_id", data.funnel_id);
    if (data.owner_id) q = q.eq("opportunities.owner_id", data.owner_id);
    if (data.unassigned) q = q.is("opportunities.owner_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ownerIds = [
      ...new Set(
        ((rows ?? []) as { opportunities: { owner_id: string | null } | null }[])
          .map((row) => row.opportunities?.owner_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ownerNames = new Map<string, string | null>();
    if (ownerIds.length > 0) {
      const { extAdmin } = await import("./server");
      const { data: profiles } = await extAdmin()
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      for (const profile of (profiles ?? []) as { id: string; full_name: string | null }[]) {
        ownerNames.set(profile.id, profile.full_name);
      }
    }
    return (rows ?? []).map((row: any) => ({
      ...row,
      opportunities: row.opportunities
        ? {
            ...row.opportunities,
            owner: row.opportunities.owner_id
              ? {
                  id: row.opportunities.owner_id,
                  full_name: ownerNames.get(row.opportunities.owner_id) ?? null,
                }
              : null,
          }
        : null,
    })) as TaskRow[];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        title: z.string().min(1),
        due_date: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_tasks").insert({
      opportunity_id: data.opportunity_id,
      title: data.title.trim(),
      due_date: data.due_date || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTaskDone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        done: z.boolean(),
        note: z.string().trim().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Concluir exige o registro do que foi feito (vai para o Histórico do cartão).
    if (data.done && !data.note) {
      throw new Error("Descreva no histórico o que foi feito para concluir a tarefa.");
    }
    const { data: task, error: readError } = await context.supabase
      .from("crm_tasks")
      .select("id, title, opportunity_id")
      .eq("id", data.id)
      .single();
    if (readError || !task) throw new Error(readError?.message ?? "Tarefa não encontrada.");
    const { error } = await context.supabase
      .from("crm_tasks")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.done && data.note) {
      const { extAdmin } = await import("./server");
      const { data: profile } = await extAdmin()
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const authorName =
        ((profile?.full_name as string | null) ?? "") || context.userEmail || "Usuário";
      const { error: noteError } = await context.supabase.from("crm_notes").insert({
        opportunity_id: task.opportunity_id,
        author_id: context.userId,
        author_name: authorName,
        body: `Concluiu ${task.title}: ${data.note}`,
      });
      if (noteError) throw new Error(noteError.message);
    }
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
