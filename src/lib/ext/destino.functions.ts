import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Destination, DestinationRule } from "./destino";
import type { FunnelStage } from "./model";

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores podem alterar o destino.");
}

// Carrega o destino, as regras, os campos e os funis disponíveis para o formulário.
export const getDestination = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ form_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { loadDestination } = await import("./destino.server");
    const { destination, rules } = await loadDestination(supabase, data.form_id);

    const { data: fields } = await supabase
      .from("form_fields")
      .select("id, label, type, options, internal, position")
      .eq("form_id", data.form_id)
      .order("position");

    const { data: funnels } = await supabase
      .from("funnels")
      .select("id, name, school_id, is_default")
      .order("name");
    const { data: stages } = await supabase.from("funnel_stages").select("*").order("position");

    return {
      destination,
      rules,
      fields: (fields ?? []) as {
        id: string;
        label: string;
        type: string;
        options: string[] | null;
        internal: boolean;
      }[],
      funnels: (funnels ?? []) as {
        id: string;
        name: string;
        school_id: string;
        is_default: boolean;
      }[],
      stages: (stages ?? []) as FunnelStage[],
    };
  });

const uuidOrNull = z.string().uuid().nullable().optional();

export const saveDestination = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        form_id: z.string().uuid(),
        name_field_id: uuidOrNull,
        phone_field_id: uuidOrNull,
        email_field_id: uuidOrNull,
        extra_fields: z.array(
          z.object({
            // Aceita o uuid de um campo ou a sentinela "submission_id" (ID do cadastro).
            field_id: z.string().min(1),
            label: z.string().nullable().optional(),
          }),
        ),
        enabled: z.boolean(),
        default_send: z.boolean(),
        default_funnel_id: uuidOrNull,
        default_stage_id: uuidOrNull,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("form_destinations").upsert(
      {
        form_id: data.form_id,
        name_field_id: data.name_field_id ?? null,
        phone_field_id: data.phone_field_id ?? null,
        email_field_id: data.email_field_id ?? null,
        extra_fields: data.extra_fields.map((e) => ({
          field_id: e.field_id,
          label: e.label?.trim() || null,
        })),
        enabled: data.enabled,
        default_send: data.default_send,
        default_funnel_id: data.default_funnel_id ?? null,
        default_stage_id: data.default_stage_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "form_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleSchema = z.object({
  label: z.string().nullable().optional(),
  send: z.boolean(),
  funnel_id: uuidOrNull,
  stage_id: uuidOrNull,
  conditions: z.array(
    z.object({
      field_id: z.string().min(1),
      op: z.enum(["eq", "neq", "contains", "empty", "not_empty", "in", "gt", "lt"]),
      value: z.string(),
    }),
  ),
});

export const saveRules = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ form_id: z.string().uuid(), rules: z.array(ruleSchema) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error: delError } = await context.supabase
      .from("form_destination_rules")
      .delete()
      .eq("form_id", data.form_id);
    if (delError) throw new Error(delError.message);

    if (data.rules.length > 0) {
      const rows = data.rules.map((r, i) => ({
        form_id: data.form_id,
        position: i,
        label: r.label?.trim() || null,
        send: r.send,
        funnel_id: r.send ? (r.funnel_id ?? null) : null,
        stage_id: r.send ? (r.stage_id ?? null) : null,
        conditions: r.conditions,
      }));
      const { error } = await context.supabase.from("form_destination_rules").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Reaplica as regras aos cadastros já existentes do formulário.
export const reprocessSubmissions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ form_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const supabase = context.supabase;
    const { applyDestination } = await import("./destino.server");

    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("id, form_id, school_id, public_id")
      .eq("form_id", data.form_id)
      .order("created_at");
    if (error) throw new Error(error.message);

    let sent = 0;
    let blocked = 0;
    let skipped = 0;

    for (const sub of (submissions ?? []) as {
      id: string;
      form_id: string;
      school_id: string;
      public_id: string;
    }[]) {
      const { data: values } = await supabase
        .from("submission_values")
        .select("field_id, value")
        .eq("submission_id", sub.id)
        .eq("part", "");
      const map: Record<string, string> = {};
      for (const v of (values ?? []) as { field_id: string; value: string }[]) {
        map[v.field_id] = v.value;
      }
      const result = await applyDestination(supabase, {
        submissionId: sub.id,
        formId: sub.form_id,
        schoolId: sub.school_id,
        publicId: sub.public_id,
        values: map,
      });
      if (result.status === "sent") sent++;
      else if (result.status === "blocked") blocked++;
      else skipped++;
    }

    return { total: (submissions ?? []).length, sent, blocked, skipped };
  });

export type DestinationData = {
  destination: Destination | null;
  rules: DestinationRule[];
};
