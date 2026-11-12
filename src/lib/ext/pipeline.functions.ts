import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { asksEnrollment, canCloseOpportunity } from "./close-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelStage, Opportunity } from "./model";

type OpportunityRow = Opportunity & {
  submissions: { public_id: string; children_count: number | null; form_id: string; list_type: string | null } | null;
  visit_at: string | null;
  crm_close_reasons: { label: string; kind: "won" | "lost" } | null;
  owner: { id: string; full_name: string | null } | null;
  display_name: string;
  series: string[];
  restricted?: boolean;
};

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseSeriesValue(value: string, childrenField: boolean): string[] {
  if (childrenField) {
    try {
      const children = JSON.parse(value) as { serie?: unknown }[];
      if (!Array.isArray(children)) return [];
      return children.map((child) => String(child?.serie ?? "").trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Respostas simples não são JSON.
  }
  return value.trim() ? [value.trim()] : [];
}

async function validateOwner(
  supabase: SupabaseClient,
  funnelId: string,
  ownerId: string | null | undefined,
) {
  if (!ownerId) return null;
  const { extAdmin } = await import("./server");
  const { data, error } = await extAdmin()
    .from("user_funnels")
    .select("user_id")
    .eq("funnel_id", funnelId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este responsável não está vinculado ao funil.");
  return ownerId;
}

async function stageContext(supabase: SupabaseClient, stageId: string) {
  const { data, error } = await supabase
    .from("funnel_stages")
    .select("id, funnel_id, funnels(id, school_id)")
    .eq("id", stageId)
    .single();
  if (error) throw new Error(error.message);
  const funnel = (data as unknown as { funnels: { id: string; school_id: string } }).funnels;
  return { funnel_id: funnel.id, school_id: funnel.school_id };
}

export const listPipeline = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        status: z.enum(["open", "won", "lost"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    {
      const { extAdmin, reconcileWonOpportunities } = await import("./server");
      await reconcileWonOpportunities(extAdmin()).catch(() => []);
    }
    const { data: stages, error } = await context.supabase
      .from("funnel_stages")
      .select("*")
      .eq("funnel_id", data.funnel_id)
      .order("position");
    if (error) throw new Error(error.message);

    const status = data.status ?? "open";
    const { data: opportunities, error: oppError } = await context.supabase
      .from("opportunities")
      .select("*, submissions(public_id, children_count, form_id, list_type), crm_close_reasons(label, kind)")
      .eq("funnel_id", data.funnel_id)
      .eq("status", status)
      .order(status === "open" ? "position" : "closed_at");
    if (oppError) throw new Error(oppError.message);

    const linkedOpportunities = (opportunities ?? []).filter(
      (opportunity: any) => opportunity.submission_id && opportunity.submissions?.form_id,
    );
    const submissionIds = linkedOpportunities.map((opportunity: any) => opportunity.submission_id);
    const formIds = [
      ...new Set(linkedOpportunities.map((opportunity: any) => opportunity.submissions.form_id)),
    ] as string[];
    const displayNames = new Map<string, string>();
    const seriesBySubmission = new Map<string, string[]>();
    const restrictedSubs = new Set<string>();

    if (submissionIds.length > 0 && formIds.length > 0) {
      // Cartões já autorizados pela RLS acima; respostas lidas com o cliente admin
      // para que todos os perfis vejam nome e série.
      const { extAdmin } = await import("./server");
      const admin = extAdmin();
      const [{ data: destinations }, { data: fields }] = await Promise.all([
        admin
          .from("form_destinations")
          .select("form_id, name_field_id")
          .in("form_id", formIds),
        admin
          .from("form_fields")
          .select("id, form_id, label, type")
          .in("form_id", formIds),
      ]);
      const nameFieldByForm = new Map(
        (destinations ?? []).map((destination) => [destination.form_id, destination.name_field_id]),
      );
      // Sem campo de nome na aba Destino: usa o campo do formulário chamado "Nome...".
      for (const field of fields ?? []) {
        if (nameFieldByForm.get(field.form_id)) continue;
        if (field.type === "children" || field.type === "address") continue;
        if (normalizeLabel(field.label).startsWith("nome")) nameFieldByForm.set(field.form_id, field.id);
      }
      const relevantFields = (fields ?? []).filter((field) => {
        const label = normalizeLabel(field.label);
        if (label.includes("acompanhamento") && (label.includes("medico") || label.includes("psicolog") || label.includes("psicopedag"))) return true;
        return (
          field.type === "children" ||
          label === "serie" ||
          label === "series" ||
          label.includes("serie de interesse") ||
          nameFieldByForm.get(field.form_id) === field.id
        );
      });
      const relevantFieldIds = relevantFields.map((field) => field.id);
      const fieldById = new Map(relevantFields.map((field) => [field.id, field]));

      if (relevantFieldIds.length > 0) {
        const { data: values } = await admin
          .from("submission_values")
          .select("submission_id, field_id, value")
          .in("submission_id", submissionIds)
          .in("field_id", relevantFieldIds)
          .eq("part", "");

        for (const answer of values ?? []) {
          const field = fieldById.get(answer.field_id);
          if (!field) continue;
          const nameFieldId = nameFieldByForm.get(field.form_id);
          if (field.id === nameFieldId && answer.value?.trim()) {
            displayNames.set(answer.submission_id, answer.value.trim());
          }
          const label = normalizeLabel(field.label);
          if (label.includes("acompanhamento") && normalizeLabel(answer.value ?? "") === "sim") {
            restrictedSubs.add(answer.submission_id);
          }
          const isSeriesField =
            field.type === "children" ||
            label === "serie" ||
            label === "series" ||
            label.includes("serie de interesse");
          if (isSeriesField && answer.value) {
            const current = seriesBySubmission.get(answer.submission_id) ?? [];
            current.push(...parseSeriesValue(answer.value, field.type === "children"));
            seriesBySubmission.set(answer.submission_id, [...new Set(current.filter(Boolean))]);
          }
        }
      }
    }

    const ownerIds = [
      ...new Set(
        ((opportunities ?? []) as { owner_id: string | null }[])
          .map((opportunity) => opportunity.owner_id)
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

    // Próxima atividade pendente de cada oportunidade.
    const ids = ((opportunities ?? []) as { id: string }[]).map((o) => o.id);
    const nextTasks: Record<string, { title: string; due_date: string | null }> = {};
    if (ids.length > 0) {
      const { data: tasks } = await context.supabase
        .from("crm_tasks")
        .select("opportunity_id, title, due_date")
        .in("opportunity_id", ids)
        .eq("done", false)
        .order("due_date", { nullsFirst: false })
        .order("created_at");
      for (const t of (tasks ?? []) as {
        opportunity_id: string;
        title: string;
        due_date: string | null;
      }[]) {
        if (!nextTasks[t.opportunity_id]) {
          nextTasks[t.opportunity_id] = { title: t.title, due_date: t.due_date };
        }
      }
    }

    return {
      stages: (stages ?? []) as FunnelStage[],
      opportunities: (opportunities ?? []).map((opportunity: any) => ({
        ...opportunity,
        display_name: opportunity.submissions?.public_id
          ? displayNames.get(opportunity.submission_id)
            ? `${opportunity.submissions.public_id} · ${displayNames.get(opportunity.submission_id)}`
            : opportunity.name
          : opportunity.name,
        series: seriesBySubmission.get(opportunity.submission_id) ?? [],
        restricted: restrictedSubs.has(opportunity.submission_id),
        owner: opportunity.owner_id
          ? { id: opportunity.owner_id, full_name: ownerNames.get(opportunity.owner_id) ?? null }
          : null,
      })) as OpportunityRow[],
      nextTasks,
    };
  });

const opportunityFields = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ stage_id: z.string().uuid() }).merge(opportunityFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = await stageContext(context.supabase, data.stage_id);
    const ownerId = await validateOwner(context.supabase, ctx.funnel_id, data.owner_id);
    const { data: last } = await context.supabase
      .from("opportunities")
      .select("position")
      .eq("stage_id", data.stage_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("opportunities").insert({
      stage_id: data.stage_id,
      funnel_id: ctx.funnel_id,
      school_id: ctx.school_id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      owner_id: ownerId,
      position: (last?.position ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid() }).merge(opportunityFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: currentError } = await context.supabase
      .from("opportunities")
      .select("funnel_id")
      .eq("id", data.id)
      .single();
    if (currentError) throw new Error(currentError.message);
    const ownerId = await validateOwner(context.supabase, current.funnel_id, data.owner_id);
    const { error } = await context.supabase
      .from("opportunities")
      .update({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOpportunityOwner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), owner_id: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: currentError } = await context.supabase
      .from("opportunities")
      .select("funnel_id")
      .eq("id", data.id)
      .single();
    if (currentError) throw new Error(currentError.message);
    const ownerId = await validateOwner(context.supabase, current.funnel_id, data.owner_id);
    const { error } = await context.supabase
      .from("opportunities")
      .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        stage_id: z.string().uuid(),
        position: z.number().int().min(0),
        owner_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = await stageContext(context.supabase, data.stage_id);
    const { data: current, error: currentError } = await context.supabase
      .from("opportunities")
      .select("stage_id, owner_confirmed_at")
      .eq("id", data.id)
      .single();
    if (currentError) throw new Error(currentError.message);
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      stage_id: data.stage_id,
      funnel_id: ctx.funnel_id,
      updated_at: now,
    };
    // Primeira troca de etapa: exige confirmar o responsável do cartão.
    if (current.stage_id !== data.stage_id && !current.owner_confirmed_at) {
      if (!data.owner_id) throw new Error("Confirme o responsável antes de mover o cartão.");
      update["owner_id"] = await validateOwner(context.supabase, ctx.funnel_id, data.owner_id);
      update["owner_confirmed_at"] = now;
    }
    const { error } = await context.supabase
      .from("opportunities")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Reordena a coluna de destino.
    const { data: list } = await context.supabase
      .from("opportunities")
      .select("id, position")
      .eq("stage_id", data.stage_id)
      .order("position");
    const ids = (list ?? []).map((o: { id: string }) => o.id).filter((id) => id !== data.id);
    ids.splice(Math.min(data.position, ids.length), 0, data.id);
    for (let i = 0; i < ids.length; i++) {
      const { error: posError } = await context.supabase
        .from("opportunities")
        .update({ position: i })
        .eq("id", ids[i]);
      if (posError) throw new Error(posError.message);
    }
    return { ok: true };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("opportunities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Fecha a oportunidade como ganha ou perdida, guardando motivo e observação.
export const closeOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        result: z.enum(["won", "lost"]),
        reason_id: z.string().uuid(),
        note: z.string().optional().nullable(),
        enrollment_count: z.number().int().positive().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Ganho e perda: Admin, Gerente da unidade ou Central vinculada ao funil.
    const { extAdmin, getPerms } = await import("./server");
    const admin = extAdmin();
    const perms = await getPerms(context.supabase, context.userId);
    const { data: opp } = await admin
      .from("opportunities")
      .select("id, funnel_id, school_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!opp) throw new Error("Cartão não encontrado.");
    if (opp.status !== "open") throw new Error("Este cartão já está fechado.");
    const { data: link } = await admin
      .from("user_funnels")
      .select("user_id")
      .eq("funnel_id", opp.funnel_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!canCloseOpportunity(perms, opp.school_id, Boolean(link)))
      throw new Error(
        `Sem permissão para marcar este cartão como ${data.result === "won" ? "ganho" : "perdido"}.`,
      );

    if (data.result === "lost") {
      const { data: reason } = await admin
        .from("crm_close_reasons")
        .select("id, kind, label")
        .eq("id", data.reason_id)
        .maybeSingle();
      if (!reason) throw new Error("Motivo não encontrado.");
      if (reason.kind !== "lost") throw new Error("Motivo não corresponde ao resultado.");

      const { data: stages } = await admin
        .from("funnel_stages")
        .select("id, name")
        .eq("funnel_id", opp.funnel_id);
      const lostStage = (stages ?? []).find((s) => /^perdid[oa]s?$/.test(normalizeLabel(s.name)));
      if (!lostStage) throw new Error("Este funil não tem a etapa \"Perdido\".");

      const now = new Date().toISOString();
      const { error: tErr } = await admin
        .from("crm_tasks")
        .update({ done: true, done_at: now })
        .eq("opportunity_id", opp.id)
        .eq("done", false);
      if (tErr) throw new Error(tErr.message);

      const { data: updated, error: upErr } = await admin
        .from("opportunities")
        .update({
          status: "lost",
          stage_id: lostStage.id,
          close_reason_id: reason.id,
          close_note: data.note?.trim() || null,
          closed_at: now,
          updated_at: now,
        })
        .eq("id", opp.id)
        .select("id");
      if (upErr) throw new Error(upErr.message);
      if (!updated?.length) throw new Error("Não foi possível marcar como perdido.");

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const authorName = profile?.full_name || context.userEmail || "Usuário";
      await admin.from("crm_notes").insert({
        opportunity_id: opp.id,
        author_id: context.userId,
        author_name: authorName,
        body: `Marcado como perdido — motivo: ${reason.label}${data.note?.trim() ? `. ${data.note.trim()}` : ""}`,
      });
      return { ok: true };
    }

    // Confere se o motivo existe e é do tipo certo.
    const { data: reason, error: reasonError } = await context.supabase
      .from("crm_close_reasons")
      .select("id, kind")
      .eq("id", data.reason_id)
      .single();
    if (reasonError || !reason) throw new Error("Motivo não encontrado.");
    if (reason.kind !== data.result) throw new Error("Motivo não corresponde ao resultado.");

    const { data: current, error: currentError } = await context.supabase
      .from("opportunities")
      .select("submission_id, submissions(list_type)")
      .eq("id", data.id)
      .single();
    if (currentError) throw new Error(currentError.message);
    const tracksEnrollment = asksEnrollment(current as never);
    if (data.result === "won" && tracksEnrollment && data.enrollment_count == null) {
      throw new Error("Informe a quantidade de matrículas efetivadas.");
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await admin
      .from("opportunities")
      .update({
        status: data.result,
        close_reason_id: data.reason_id,
        close_note: data.note?.trim() || null,
        closed_at: now,
        updated_at: now,
      })
      .eq("id", data.id)
      .select("submission_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Ganho no CRM = matrícula realizada no cadastro.
    if (updated?.submission_id && tracksEnrollment) {
      const won = data.result === "won";
      const { data: previousSubmission } = await admin
        .from("submissions")
        .select("enrolled, enrollment_count")
        .eq("id", updated.submission_id)
        .single();
      await admin
        .from("submissions")
        .update({
          enrolled: won,
          enrollment_count: won ? data.enrollment_count : 0,
          enrolled_at: won ? now : null,
          enrolled_by: won ? context.userId : null,
        })
        .eq("id", updated.submission_id);
      await admin.from("audit_log").insert({
        submission_id: updated.submission_id,
        actor_id: context.userId,
        actor_email: context.userEmail,
        action: "update",
        changes: [
          {
            field_id: "enrolled",
            label: "Matrícula",
            before: previousSubmission?.enrolled ? "Sim" : "Não",
            after: won ? "Sim" : "Não",
          },
          {
            field_id: "enrollment_count",
            label: "Quantidade de matrículas",
            before: String(previousSubmission?.enrollment_count ?? 0),
            after: String(won ? data.enrollment_count : 0),
          },
        ],
      });
    }
    return { ok: true };
  });

// Reabre uma oportunidade fechada, voltando para a etapa em que estava.
export const reopenOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("opportunities")
      .update({
        status: "open",
        close_reason_id: null,
        close_note: null,
        closed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("submission_id, submissions(list_type)")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (updated?.submission_id && asksEnrollment(updated as never)) {
      await context.supabase
        .from("submissions")
        .update({ enrolled: false, enrollment_count: 0, enrolled_at: null, enrolled_by: null })
        .eq("id", updated.submission_id);
    }
    return { ok: true };
  });

// Dados do cliente (respostas do formulário) para quem tem acesso ao cartão.
export const getOpportunityCustomer = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ opportunity_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // RLS: só retorna se o usuário enxerga o cartão.
    const { data: opp, error } = await context.supabase
      .from("opportunities")
      .select("id, submission_id")
      .eq("id", data.opportunity_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) throw new Error("Sem acesso a este cartão.");
    if (!opp.submission_id) return { items: [] as { label: string; type: string; lines: string[] }[] };

    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { data: sub } = await admin
      .from("submissions")
      .select("id, form_id")
      .eq("id", opp.submission_id)
      .maybeSingle();
    if (!sub) return { items: [] };
    const [{ data: fields }, { data: values }] = await Promise.all([
      admin.from("form_fields").select("id, label, type, position").eq("form_id", sub.form_id).order("position"),
      admin.from("submission_values").select("field_id, part, value").eq("submission_id", sub.id),
    ]);
    const byField = new Map<string, { part: string; value: string }[]>();
    for (const v of (values ?? []) as { field_id: string; part: string | null; value: string | null }[]) {
      if (!v.value) continue;
      const list = byField.get(v.field_id) ?? [];
      list.push({ part: v.part ?? "", value: v.value });
      byField.set(v.field_id, list);
    }
    const { parseChildren } = await import("./model");
    const order = ["cep", "rua", "numero", "complemento", "bairro", "cidade", "estado"];
    const items: { label: string; type: string; lines: string[] }[] = [];
    for (const f of (fields ?? []) as { id: string; label: string; type: string }[]) {
      const vals = byField.get(f.id);
      if (!vals?.length) continue;
      let lines: string[] = [];
      const main = vals.find((v) => v.part === "")?.value ?? "";
      if (f.type === "children") {
        lines = parseChildren(main).map((c, i) =>
          [`${i + 1}. ${c.nome}`, c.nascimento && `nasc. ${c.nascimento}`, c.serie, c.turno]
            .filter(Boolean)
            .join(" · "),
        );
      } else if (f.type === "address") {
        const parts = vals.filter((v) => v.part);
        if (parts.length) {
          parts.sort((a, b) => order.indexOf(a.part) - order.indexOf(b.part));
          lines = [parts.map((p) => p.value).join(", ")];
        } else {
          try {
            const o = JSON.parse(main) as Record<string, unknown>;
            lines = [order.map((k) => o[k]).filter(Boolean).join(", ")];
          } catch {
            lines = [main];
          }
        }
      } else {
        try {
          const parsed = JSON.parse(main) as unknown;
          lines = Array.isArray(parsed) ? [parsed.map(String).join(", ")] : [main];
        } catch {
          lines = [main];
        }
      }
      lines = lines.filter((l) => l.trim());
      if (lines.length) items.push({ label: f.label, type: f.type, lines });
    }
    return { items };
  });

// Agenda (ou remove) a visita de um cartão vindo da Lista de LEADS.
export const setOpportunityVisit = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), visit_at: z.string().datetime({ offset: true }).nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    if (perms.isDirecao && !perms.isAdmin) throw new Error("Seu perfil é somente leitura.");
    const { data: opp, error } = await context.supabase
      .from("opportunities")
      .select("id, submissions(list_type)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) throw new Error("Sem acesso a este cartão.");
    const lt = (opp as unknown as { submissions: { list_type: string | null } | null }).submissions?.list_type;
    if (!lt) throw new Error("Agendamento disponível apenas para cartões vindos de cadastros.");
    const { error: upError } = await context.supabase
      .from("opportunities")
      .update({ visit_at: data.visit_at, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (upError) throw new Error(upError.message);

    // Agendou: move o cartão para "Visita agendada" (LEADS) ou "Matrícula agendada" (Pós Visita).
    if (data.visit_at) {
      const { extAdmin } = await import("./server");
      const admin = extAdmin();
      const { data: full } = await admin
        .from("opportunities")
        .select("id, funnel_id, stage_id, owner_id, owner_confirmed_at")
        .eq("id", data.id)
        .single();
      const { data: stages } = await admin
        .from("funnel_stages")
        .select("id, name")
        .eq("funnel_id", full!.funnel_id);
      const isLead = lt === "leads" || lt === "lead";
      const target =
        (stages ?? []).find((s) => normalizeLabel(s.name).includes(isLead ? "visita agendada" : "matricula agendada")) ??
        (stages ?? []).find((s) => {
          const n = normalizeLabel(s.name);
          return n.includes("visita agendada") || n.includes("matricula agendada");
        });
      const kindLabel = target && normalizeLabel(target.name).includes("visita") ? "Visita" : "Matrícula";
      const now = new Date().toISOString();
      if (target && full && full.stage_id !== target.id) {
        const { data: last } = await admin
          .from("opportunities")
          .select("position")
          .eq("stage_id", target.id)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error: mvErr } = await admin
          .from("opportunities")
          .update({
            stage_id: target.id,
            position: (last?.position ?? -1) + 1,
            updated_at: now,
            ...(!full.owner_confirmed_at && full.owner_id ? { owner_confirmed_at: now } : {}),
          })
          .eq("id", data.id);
        if (mvErr) throw new Error(mvErr.message);
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const authorName = profile?.full_name || context.userEmail || "Usuário";
      const when = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date(data.visit_at))
        .replace(",", " às");
      await admin.from("crm_notes").insert({
        opportunity_id: data.id,
        author_id: context.userId,
        author_name: authorName,
        body: `${kindLabel} agendada para ${when} — por ${authorName}.`,
      });
    }
    return { ok: true };
  });
