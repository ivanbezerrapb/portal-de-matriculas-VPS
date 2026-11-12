import { funnelListType } from "./model";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { compareSchoolNames } from "@/lib/school-order";

// ---------- Listagem com busca por ID e filtros ----------

export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        search: z.string().optional(),
        school_id: z.string().uuid().optional(),
        form_id: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        list_type: z.enum(["visitantes", "leads"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("submissions")
      .select(
        "*, forms(title), schools(name), attendant:presenters!submissions_attendant_id_fkey(id, name), presenter:presenters!submissions_presenter_id_fkey(id, name), enroller:presenters!submissions_enroller_id_fkey(id, name)",
      )
      .eq("list_type", data.list_type ?? "visitantes")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) {
      query = query.ilike("public_id", `%${data.search.trim()}%`);
    }
    if (data.school_id) query = query.eq("school_id", data.school_id);
    if (data.form_id) query = query.eq("form_id", data.form_id);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return rows;

    // Nome do responsável de cada cadastro
    const formIds = [...new Set(rows.map((r) => r.form_id))];
    const { data: ff } = await context.supabase
      .from("form_fields")
      .select("id, form_id, label, type, position, options")
      .in("form_id", formIds)
      .order("position");
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const { splitChildOptions } = await import("./model");
    const childSeriesByForm = new Map<string, string[]>();
    for (const f of (ff ?? []) as { form_id: string; type: string; options: string[] | null }[]) {
      if (f.type === "children" && !childSeriesByForm.has(f.form_id))
        childSeriesByForm.set(f.form_id, splitChildOptions(f.options).series);
    }

    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const fieldByForm = new Map<string, string>();
    for (const f of ff ?? []) {
      if (fieldByForm.has(f.form_id)) continue;
      if (norm(f.label) === "nome do responsavel") fieldByForm.set(f.form_id, f.id);
    }
    for (const f of ff ?? []) {
      if (fieldByForm.has(f.form_id)) continue;
      if (f.type === "short_text") fieldByForm.set(f.form_id, f.id);
    }

    // Campos de "acompanhamento médico/psicológico/psicopedagógico" (alerta de restrição)
    const restrictionFieldIds = new Set<string>();
    for (const f of ff ?? []) {
      const l = norm(f.label);
      if (
        l.includes("acompanhamento") &&
        (l.includes("medico") || l.includes("psicolog") || l.includes("psicopedag"))
      ) {
        restrictionFieldIds.add(f.id);
      }
    }

    // Campos de crianças e de série por formulário
    const childrenFieldIds = new Set<string>();
    const seriesFieldIds = new Set<string>();
    for (const f of ff ?? []) {
      if (f.type === "children") childrenFieldIds.add(f.id);
      const label = norm(f.label);
      if (
        f.type !== "children" &&
        (label === "serie" || label === "series" || label.includes("serie de interesse"))
      ) {
        seriesFieldIds.add(f.id);
      }
    }

    const fieldIds = [
      ...new Set([
        ...fieldByForm.values(),
        ...restrictionFieldIds,
        ...childrenFieldIds,
        ...seriesFieldIds,
      ]),
    ];
    const valueMap = new Map<string, string>();
    const restrictedIds = new Set<string>();
    if (fieldIds.length > 0) {
      const vals = await fetchValuesInBatches<{ submission_id: string; field_id: string; value: string | null }>(
        context.supabase, "submission_id, field_id, value", rows.map((r) => r.id as string), fieldIds,
      );
      for (const v of vals ?? []) {
        valueMap.set(`${v.submission_id}:${v.field_id}`, v.value ?? "");
        if (restrictionFieldIds.has(v.field_id) && norm(v.value ?? "") === "sim") {
          restrictedIds.add(v.submission_id);
        }
      }
    }

    // Funil atual de cada cadastro (cartão no CRM).
    const { data: opps } = await context.supabase
      .from("opportunities")
      .select("submission_id, funnel_id, status, funnels(name)")
      .in(
        "submission_id",
        rows.map((r) => r.id),
      );
    const funnelBySubmission = new Map<string, { funnel_id: string; funnel_name: string }>();
    for (const o of (opps ?? []) as unknown as {
      submission_id: string | null;
      funnel_id: string;
      funnels: { name: string } | null;
    }[]) {
      if (!o.submission_id) continue;
      funnelBySubmission.set(o.submission_id, {
        funnel_id: o.funnel_id,
        funnel_name: o.funnels?.name ?? "",
      });
    }

    const { data: checkIns } = await context.supabase
      .from("audit_log")
      .select("submission_id, actor_id, actor_email, created_at")
      .in(
        "submission_id",
        rows.map((r) => r.id),
      )
      .eq("action", "check_in")
      .order("created_at", { ascending: false });
    const checkInBySubmission = new Map<
      string,
      { checked_in_at: string; checked_in_by: string | null; checked_in_by_email: string | null }
    >();
    for (const entry of checkIns ?? []) {
      if (checkInBySubmission.has(entry.submission_id)) continue;
      checkInBySubmission.set(entry.submission_id, {
        checked_in_at: entry.created_at,
        checked_in_by: entry.actor_id,
        checked_in_by_email: entry.actor_email,
      });
    }

    return rows.map((r) => {
      const fid = fieldByForm.get(r.form_id);
      const name = fid ? valueMap.get(`${r.id}:${fid}`) : "";
      const funnel = funnelBySubmission.get(r.id) ?? null;
      // Séries dos alunos: lê o JSON do campo "children" deste cadastro
      let series: string[] = [];
      for (const cfid of childrenFieldIds) {
        const raw = valueMap.get(`${r.id}:${cfid}`);
        if (!raw) continue;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            series = arr.map((c) => String(c?.serie ?? "").trim());
          }
        } catch {
          /* valor inesperado: ignora */
        }
        break;
      }
      for (const sfid of seriesFieldIds) {
        const raw = valueMap.get(`${r.id}:${sfid}`)?.trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            series.push(...parsed.map((value) => String(value).trim()).filter(Boolean));
          } else {
            series.push(raw);
          }
        } catch {
          series.push(raw);
        }
      }
      series = [...new Set(series.filter(Boolean))];
      return {
        ...r,
        responsible_name: name?.trim() || null,
        funnel,
        restricted: restrictedIds.has(r.id),
        series,
        check_in: checkInBySubmission.get(r.id) ?? null,
        child_series_options: childSeriesByForm.get(r.form_id) ?? null,
        can_edit_children:
          childSeriesByForm.has(r.form_id) && (perms.isAdmin || perms.managerSchools.includes(r.school_id)),
      };
    });
  });

// ---------- Detalhe ----------

export const getSubmission = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("*, forms(id, title, school_id), schools(name)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: fields }, { data: values }, { data: history }] = await Promise.all([
      context.supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", submission.form_id)
        .order("position"),
      context.supabase
        .from("submission_values")
        .select("*")
        .eq("submission_id", data.id)
        .eq("part", ""),
      context.supabase
        .from("audit_log")
        .select("*")
        .eq("submission_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      submission,
      fields: fields ?? [],
      values: values ?? [],
      history: history ?? [],
    };
  });

// ---------- Edição interna (admin, editor, gestor da escola) ----------

export const updateSubmission = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, form_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const allowed =
      perms.isAdmin ||
      perms.managerSchools.includes(submission.school_id) ||
      perms.infoSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para editar este cadastro.");
    }

    const { data: current } = await context.supabase
      .from("submission_values")
      .select("field_id, value")
      .eq("submission_id", data.id)
      .eq("part", "");
    const currentMap = new Map((current ?? []).map((v) => [v.field_id, v.value ?? ""]));

    const { data: fields } = await context.supabase
      .from("form_fields")
      .select("id, label, type")
      .eq("form_id", submission.form_id);
    const fieldLabels = new Map((fields ?? []).map((f) => [f.id, f.label]));
    const childrenFieldIds = new Set(
      (fields ?? []).filter((f) => f.type === "children").map((f) => f.id),
    );

    const changes: {
      field_id: string;
      label: string;
      before: string;
      after: string;
    }[] = [];

    for (const [fieldId, raw] of Object.entries(data.values)) {
      const after = Array.isArray(raw) ? JSON.stringify(raw) : raw.trim();
      const before = currentMap.get(fieldId) ?? "";
      if (before === after) continue;
      changes.push({
        field_id: fieldId,
        label: fieldLabels.get(fieldId) ?? fieldId,
        before,
        after,
      });
      const { error: upsertError } = await context.supabase
        .from("submission_values")
        .upsert(
          { submission_id: data.id, field_id: fieldId, part: "", value: after },
          { onConflict: "submission_id,field_id,part" },
        );
      if (upsertError) throw new Error(upsertError.message);

      // Endereço: sincroniza as partes gravadas separadamente.
      const fieldType = (fields ?? []).find((f) => f.id === fieldId)?.type;
      if (fieldType === "address") {
        await context.supabase
          .from("submission_values")
          .delete()
          .eq("submission_id", data.id)
          .eq("field_id", fieldId)
          .neq("part", "");
        if (after) {
          const { addressPartRows } = await import("./model");
          const partRows = addressPartRows(data.id, fieldId, after);
          if (partRows.length > 0) {
            const { error: partsError } = await context.supabase
              .from("submission_values")
              .insert(partRows);
            if (partsError) throw new Error(partsError.message);
          }
        }
      }
    }

    // Recalcula a coluna children_count a partir dos campos "N Filhos" enviados.
    let childrenCount: number | null | undefined;
    for (const fieldId of childrenFieldIds) {
      const raw = data.values[fieldId];
      if (raw == null) continue;
      if (childrenCount === undefined) childrenCount = null;
      const text = Array.isArray(raw) ? JSON.stringify(raw) : raw.trim();
      if (!text) continue;
      const { parseChildren } = await import("./model");
      const n = parseChildren(text).length;
      if (n > 0) childrenCount = Math.max(childrenCount ?? 0, n);
    }

    if (childrenCount !== undefined) {
      const { writeChildrenCountValue } = await import("./server");
      await writeChildrenCountValue(context.supabase, submission.form_id, data.id, childrenCount);
    }

    if (changes.length > 0 || childrenCount !== undefined) {
      await context.supabase
        .from("submissions")
        .update({
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
          ...(childrenCount !== undefined ? { children_count: childrenCount } : {}),
        })
        .eq("id", data.id);
    }

    if (changes.length > 0) {
      await context.supabase.from("audit_log").insert({
        submission_id: data.id,
        actor_id: context.userId,
        actor_email: context.userEmail,
        action: "update",
        changes,
      });
    }

    return { ok: true, changed: changes.length };
  });

// ---------- Matrícula (ganho pela tela de cadastros) ----------

export const setEnrollment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        enrolled: z.boolean(),
        enrollment_count: z.number().int().positive().optional(),
      })
      .superRefine((value, ctx) => {
        if (value.enrolled && value.enrollment_count == null) {
          ctx.addIssue({
            code: "custom",
            path: ["enrollment_count"],
            message: "Informe a quantidade de matrículas efetivadas.",
          });
        }
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, enrolled, enrollment_count")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const allowed =
      perms.isAdmin ||
      perms.managerSchools.includes(submission.school_id) ||
      perms.operatorSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para alterar a matrícula deste cadastro.");
    }

    const now = new Date().toISOString();
    const { error: updError } = await context.supabase
      .from("submissions")
      .update({
        enrolled: data.enrolled,
        enrollment_count: data.enrolled ? data.enrollment_count : 0,
        enrolled_at: data.enrolled ? now : null,
        enrolled_by: data.enrolled ? context.userId : null,
        updated_at: now,
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (updError) throw new Error(updError.message);

    // Sincroniza a oportunidade ligada a este cadastro, quando existir.
    const { data: opportunity } = await context.supabase
      .from("opportunities")
      .select("id, status")
      .eq("submission_id", data.id)
      .maybeSingle();

    if (opportunity) {
      if (data.enrolled) {
        // ganho, etapa e histórico feitos por reconcileWonOpportunities abaixo
      } else {
        await context.supabase
          .from("opportunities")
          .update({
            status: "open",
            close_reason_id: null,
            close_note: null,
            closed_at: null,
            updated_at: now,
          })
          .eq("id", opportunity.id);
      }
    }

    await context.supabase.from("audit_log").insert({
      submission_id: data.id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        {
          field_id: "enrolled",
          label: "Matrícula",
          before: submission.enrolled ? "Sim" : "Não",
          after: data.enrolled ? "Sim" : "Não",
        },
        {
          field_id: "enrollment_count",
          label: "Quantidade de matrículas",
          before: String(submission.enrollment_count ?? 0),
          after: String(data.enrolled ? data.enrollment_count : 0),
        },
      ],
    });

    if (data.enrolled) {
      const { extAdmin, reconcileWonOpportunities } = await import("./server");
      await reconcileWonOpportunities(extAdmin(), [data.id]);
    }
    return { ok: true };
  });

// ---------- Check-in definitivo da Lista de LEADS ----------

export const setLeadCheckIn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, list_type, public_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (submission.list_type !== "leads") {
      throw new Error("O check-in está disponível somente para a Lista de LEADS.");
    }

    const allowed =
      perms.isAdmin ||
      perms.managerSchools.includes(submission.school_id) ||
      perms.operatorSchools.includes(submission.school_id);
    if (!allowed) throw new Error("Você não tem permissão para confirmar este check-in.");

    const { data: existingCheckIn } = await context.supabase
      .from("audit_log")
      .select("id, created_at")
      .eq("submission_id", data.id)
      .eq("action", "check_in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingCheckIn) {
      throw new Error("O check-in deste LEAD já foi confirmado e não pode ser desfeito.");
    }

    const now = new Date().toISOString();
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { data: opps, error: oppsError } = await admin
      .from("opportunities")
      .select("id, funnel_id, status")
      .eq("submission_id", data.id);
    if (oppsError) throw new Error(oppsError.message);
    const opportunity = (opps ?? [])[0] ?? null;

    if (opps && opps.length) {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
      const authorName = (prof as { full_name?: string } | null)?.full_name || context.userEmail || "Usuário";
      const when = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(now)).replace(",", " às");
      for (const opp of opps) {
        const { error: tasksError } = await admin
          .from("crm_tasks")
          .update({ done: true, done_at: now })
          .eq("opportunity_id", opp.id)
          .eq("done", false);
        if (tasksError) throw new Error(tasksError.message);

        const { data: stages } = await admin.from("funnel_stages").select("id, name").eq("funnel_id", opp.funnel_id);
        const doneStage = (stages ?? []).find((s) => /realizad/i.test(s.name));

        const { data: updated, error: opportunityError } = await admin
          .from("opportunities")
          .update({
            status: "won",
            ...(doneStage ? { stage_id: doneStage.id } : {}),
            close_reason_id: null,
            close_note: "Check-in confirmado (visita realizada).",
            closed_at: now,
            updated_at: now,
          })
          .eq("id", opp.id)
          .select("id");
        if (opportunityError) throw new Error(opportunityError.message);
        if (!updated?.length) throw new Error("Não foi possível dar ganho no cartão.");

        await admin.from("crm_notes").insert({
          opportunity_id: opp.id,
          author_id: context.userId,
          author_name: authorName,
          body: `Visita realizada em ${when} — check-in por ${authorName}.`,
        });
      }
    }

    const { error: auditError } = await context.supabase.from("audit_log").insert({
      submission_id: data.id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "check_in",
      changes: [
        {
          field_id: "check_in",
          label: "Check-in",
          before: "Não",
          after: "Sim",
        },
        {
          field_id: "checked_in_at",
          label: "Data do check-in",
          before: "",
          after: now,
        },
      ],
    });
    if (auditError) throw new Error(auditError.message);

    await context.supabase
      .from("submissions")
      .update({ updated_at: now, updated_by: context.userId })
      .eq("id", data.id);

    await reconcileAfter(data.id);
    return { ok: true, checked_in_at: now, opportunity_closed: Boolean(opportunity) };
  });

// ---------- Envio manual do lead para um funil ----------

export const sendSubmissionToFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        submission_id: z.string().uuid(),
        funnel_id: z.string().uuid(),
        attendant_user_id: z.string().uuid().optional(),
        attendant_name: z.string().trim().min(2).max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, form_id, public_id, list_type")
      .eq("id", data.submission_id)
      .single();
    if (error) throw new Error(error.message);

    if (
      !perms.isAdmin &&
      !perms.managerSchools.includes(submission.school_id) &&
      !perms.operatorSchools.includes(submission.school_id)
    ) {
      throw new Error("Você não tem permissão para alterar este cadastro.");
    }

    const { data: funnel } = await context.supabase
      .from("funnels")
      .select("id, school_id, name")
      .eq("id", data.funnel_id)
      .maybeSingle();
    if (!funnel) throw new Error("Funil não encontrado.");
    if (funnelListType(funnel.name) !== ((submission as { list_type?: string }).list_type ?? "visitantes")) {
      throw new Error("Este funil não pertence a esta lista.");
    }
    if (funnel.school_id !== submission.school_id) {
      throw new Error("Este funil é de outra unidade.");
    }

    const { extAdmin } = await import("./server");
    const { data: ownerLinks, error: ownersError } = await extAdmin()
      .from("user_funnels")
      .select("user_id")
      .eq("funnel_id", funnel.id);
    if (ownersError) throw new Error(ownersError.message);

    let ownerId: string | null = null;
    if (data.attendant_user_id) {
      const isLinked = ownerLinks?.some((link) => link.user_id === data.attendant_user_id);
      if (!isLinked) throw new Error("Este responsável não está vinculado ao funil.");
      ownerId = data.attendant_user_id;
    } else if (ownerLinks?.length === 1) {
      ownerId = ownerLinks[0]?.user_id ?? null;
    } else if ((ownerLinks?.length ?? 0) > 1) {
      throw new Error("Escolha o responsável por este cartão antes de enviar ao funil.");
    }

    const { data: stage } = await context.supabase
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", funnel.id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!stage) throw new Error("Este funil ainda não tem etapas.");

    const admin = extAdmin();
    const { data: last } = await admin
      .from("opportunities")
      .select("position")
      .eq("stage_id", stage.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? -1) + 1;

    const { data: existing } = await admin
      .from("opportunities")
      .select("id")
      .eq("submission_id", submission.id)
      .maybeSingle();

    if (existing) {
      const { error: moveError } = await admin
        .from("opportunities")
        .update({
          funnel_id: funnel.id,
          stage_id: stage.id,
          position,
          status: "open",
          close_reason_id: null,
          close_note: null,
          closed_at: null,
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (moveError) throw new Error(moveError.message);
    } else {
      // Nome do cartão: ID do cadastro + responsável (quando houver).
      const { data: destination } = await context.supabase
        .from("form_destinations")
        .select("name_field_id, phone_field_id, email_field_id")
        .eq("form_id", submission.form_id)
        .maybeSingle();
      const fieldIds = [
        destination?.name_field_id,
        destination?.phone_field_id,
        destination?.email_field_id,
      ].filter(Boolean) as string[];
      const values = new Map<string, string>();
      if (fieldIds.length > 0) {
        const { data: vals } = await context.supabase
          .from("submission_values")
          .select("field_id, value")
          .eq("submission_id", submission.id)
          .eq("part", "")
          .in("field_id", fieldIds);
        for (const v of vals ?? []) values.set(v.field_id, (v.value ?? "").trim());
      }
      const pick = (fieldId: string | null | undefined) =>
        (fieldId ? values.get(fieldId) : "") || null;
      const responsible = pick(destination?.name_field_id);
      const cardName = responsible
        ? `${submission.public_id} · ${responsible}`
        : submission.public_id;

      const { error: insertError } = await admin.from("opportunities").insert({
        funnel_id: funnel.id,
        stage_id: stage.id,
        school_id: submission.school_id,
        submission_id: submission.id,
        name: cardName,
        phone: pick(destination?.phone_field_id),
        email: pick(destination?.email_field_id),
        owner_id: ownerId,
        position,
      });
      if (insertError) throw new Error(insertError.message);
    }

    await admin
      .from("submissions")
      .update({ crm_status: "sent", crm_reason: `Enviado manualmente para ${funnel.name}` })
      .eq("id", submission.id);

    // Atendimento: nome do responsável pelo funil escolhido.
    let attendantId: string | null = null;
    if (data.attendant_name) {
      const name = data.attendant_name.trim();
      const { data: found } = await context.supabase
        .from("presenters")
        .select("id")
        .eq("school_id", submission.school_id)
        .eq("kind", "secretaria")
        .ilike("name", name)
        .maybeSingle();
      if (found) {
        attendantId = found.id;
      } else {
        const { data: created, error: createError } = await context.supabase
          .from("presenters")
          .insert({ school_id: submission.school_id, kind: "secretaria", name })
          .select("id")
          .single();
        if (createError) throw new Error(createError.message);
        attendantId = created.id;
      }
      const { error: updError } = await context.supabase
        .from("submissions")
        .update({
          attendant_id: attendantId,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        })
        .eq("id", submission.id);
      if (updError) throw new Error(updError.message);
    }

    await reconcileAfter(data.submission_id);
    return { ok: true, funnel_id: funnel.id, attendant_id: attendantId };
  });

// ---------- Quem atendeu / quem apresentou ----------

export const setSubmissionPeople = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        submission_id: z.string().uuid(),
        kind: z.enum(["secretaria", "coordenacao", "efetivacao"]),
        presenter_id: z.string().uuid().nullable().optional(),
        new_name: z.string().trim().min(2).max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, attendant_id, presenter_id, enroller_id")
      .eq("id", data.submission_id)
      .single();
    if (error) throw new Error(error.message);

    if (
      !perms.isAdmin &&
      !perms.managerSchools.includes(submission.school_id) &&
      !perms.operatorSchools.includes(submission.school_id)
    ) {
      throw new Error("Você não tem permissão para alterar este cadastro.");
    }

    let presenterId: string | null = data.presenter_id ?? null;
    if (data.new_name) {
      const { data: created, error: createError } = await context.supabase
        .from("presenters")
        .insert({ school_id: submission.school_id, kind: data.kind, name: data.new_name.trim() })
        .select("id")
        .single();
      if (createError) {
        if (createError.code === "23505") {
          const { data: existing } = await context.supabase
            .from("presenters")
            .select("id")
            .eq("school_id", submission.school_id)
            .eq("kind", data.kind)
            .ilike("name", data.new_name.trim())
            .maybeSingle();
          if (!existing) throw new Error(createError.message);
          presenterId = existing.id;
        } else {
          throw new Error(createError.message);
        }
      } else {
        presenterId = created.id;
      }
    }

    const column =
      data.kind === "secretaria"
        ? "attendant_id"
        : data.kind === "coordenacao"
          ? "presenter_id"
          : "enroller_id";
    const kindLabel =
      data.kind === "secretaria"
        ? "Atendimento"
        : data.kind === "coordenacao"
          ? "Apresentação"
          : "Efetivação";
    const { error: updError } = await context.supabase
      .from("submissions")
      .update({
        [column]: presenterId,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", data.submission_id);
    if (updError) throw new Error(updError.message);

    await context.supabase.from("audit_log").insert({
      submission_id: data.submission_id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        {
          field_id: column,
          label: kindLabel,
          before: String((submission as unknown as Record<string, string | null>)[column] ?? ""),
          after: String(presenterId ?? ""),
        },
      ],
    });

    return { ok: true, presenter_id: presenterId };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dashboard ----------

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ schoolIds: z.array(z.string().uuid()).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Ano de campanha: 01/08 do ano corrente até 31/07 do ano seguinte.
    // Ex.: campanha 2027 = 01/08/2026 a 31/07/2027.
    const now = new Date();
    const campaignYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    const start = `${campaignYear - 1}-08-01T00:00:00`;
    const end = `${campaignYear}-08-01T00:00:00`;

    let query = context.supabase
      .from("submissions")
      .select(
        "id, form_id, school_id, created_at, enrolled, enrollment_count, schools(name), attendant:presenters!submissions_attendant_id_fkey(name), presenter:presenters!submissions_presenter_id_fkey(name), enroller:presenters!submissions_enroller_id_fkey(name)",
      )
      .eq("list_type", "visitantes")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (data.schoolIds && data.schoolIds.length > 0) {
      query = query.in("school_id", data.schoolIds);
    }
    const { data: submissions, error } = await query;
    if (error) throw new Error(error.message);

    let lossesQuery = context.supabase
      .from("opportunities")
      .select("close_reason_id, crm_close_reasons(label)")
      .eq("status", "lost")
      .gte("closed_at", start)
      .lt("closed_at", end);
    if (data.schoolIds && data.schoolIds.length > 0) {
      lossesQuery = lossesQuery.in("school_id", data.schoolIds);
    }
    const { data: losses, error: lossesError } = await lossesQuery;
    if (lossesError) throw new Error(lossesError.message);

    const rows = submissions ?? [];
    const bySchool = new Map<string, { name: string; visits: number; children: number }>();
    // Série mensal do ano letivo (índice 0 = agosto ... 11 = julho).
    const monthlyVisits = Array.from({ length: 12 }, () => 0);
    const monthlyChildren = Array.from({ length: 12 }, () => 0);
    // Série diária do ano letivo (esparso): mês (0 = agosto) + dia do mês.
    const dailyBuckets = new Map<string, { month: number; day: number; visits: number; children: number }>();
    const submissionDate = new Map<string, { month: number; day: number }>();
    for (const row of rows) {
      const name = (row.schools as { name?: string } | null)?.name ?? "—";
      const entry = bySchool.get(row.school_id) ?? { name, visits: 0, children: 0 };
      entry.visits += 1;
      bySchool.set(row.school_id, entry);
      const created = new Date(row.created_at as string);
      if (!Number.isNaN(created.getTime())) {
        const index = (created.getMonth() - 7 + 12) % 12;
        const day = created.getDate();
        monthlyVisits[index] = (monthlyVisits[index] ?? 0) + 1;
        const key = `${index}-${day}`;
        const bucket = dailyBuckets.get(key) ?? { month: index, day, visits: 0, children: 0 };
        bucket.visits += 1;
        dailyBuckets.set(key, bucket);
        submissionDate.set(row.id as string, { month: index, day });
      }
    }

    // Cartões cujo atendimento já foi iniciado (saíram da 1ª etapa ao menos uma vez).
    const startedSubs = new Set<string>();
    const wonSubs = new Set<string>();
    for (const r0 of rows) if (r0.enrolled) wonSubs.add(r0.id as string);
    {
      const ids = rows.filter((r) => (r as unknown as { attendant: unknown }).attendant).map((r) => r.id as string);
      const opps: { submission_id: string | null; funnel_id: string; stage_id: string; status: string; owner_confirmed_at: string | null }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data: chunk } = await context.supabase
          .from("opportunities")
          .select("submission_id, funnel_id, stage_id, status, owner_confirmed_at")
          .in("submission_id", ids.slice(i, i + 200));
        opps.push(...((chunk ?? []) as typeof opps));
      }
      const funnelIds = [...new Set(opps.map((o) => o.funnel_id))];
      const firstStage = new Map<string, string>();
      if (funnelIds.length) {
        const { data: stages } = await context.supabase
          .from("funnel_stages")
          .select("id, funnel_id, position")
          .in("funnel_id", funnelIds)
          .order("position", { ascending: true });
        for (const st of (stages ?? []) as { id: string; funnel_id: string }[]) {
          if (!firstStage.has(st.funnel_id)) firstStage.set(st.funnel_id, st.id);
        }
      }
      for (const o of opps) {
        if (!o.submission_id) continue;
        if (o.status === "won") wonSubs.add(o.submission_id);
        if (o.status !== "open" || o.owner_confirmed_at || (firstStage.get(o.funnel_id) && o.stage_id !== firstStage.get(o.funnel_id))) {
          startedSubs.add(o.submission_id);
        }
      }
    }
    const attendantStarted = new Map<string, Map<string, number>>();
    const attendantWon = new Map<string, Map<string, number>>();

    const attendantCounts = new Map<string, number>();
    const presenterCounts = new Map<string, number>();
    const attendantsBySchoolMap = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const attendant = (row as unknown as { attendant: { name?: string } | null }).attendant;
      const presenter = (row as unknown as { presenter: { name?: string } | null }).presenter;
      const a = attendant?.name?.trim();
      const p = presenter?.name?.trim();
      if (a) attendantCounts.set(a, (attendantCounts.get(a) ?? 0) + 1);
      if (p) presenterCounts.set(p, (presenterCounts.get(p) ?? 0) + 1);
      if (a) {
        const sName = (row.schools as { name?: string } | null)?.name ?? "—";
        const m = attendantsBySchoolMap.get(sName) ?? new Map<string, number>();
        m.set(a, (m.get(a) ?? 0) + 1);
        attendantsBySchoolMap.set(sName, m);
        if (startedSubs.has(row.id as string)) {
          const sm = attendantStarted.get(sName) ?? new Map<string, number>();
          sm.set(a, (sm.get(a) ?? 0) + 1);
          attendantStarted.set(sName, sm);
        }
        if (wonSubs.has(row.id as string)) {
          const wm = attendantWon.get(sName) ?? new Map<string, number>();
          wm.set(a, (wm.get(a) ?? 0) + 1);
          attendantWon.set(sName, wm);
        }
      }
    }
    for (const s of bySchool.values()) {
      if (!attendantsBySchoolMap.has(s.name)) attendantsBySchoolMap.set(s.name, new Map());
    }
    const attendantsBySchool = [...attendantsBySchoolMap.entries()]
      .map(([school, m]) => ({
        school,
        items: [...m.entries()]
          .map(([label, count]) => ({ label, count, started: attendantStarted.get(school)?.get(label) ?? 0, won: attendantWon.get(school)?.get(label) ?? 0 }))
          .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label, "pt-BR")),
      }))
      .sort((x, y) => compareSchoolNames(x.school, y.school));

    // Central de Informações: LEADS por responsável do card (owner_id).
    let leadOwnersBySchool: { school: string; items: { label: string; count: number; started: number; won: number }[] }[] = [];
    {
      let lq = context.supabase
        .from("submissions")
        .select("id, schools(name)")
        .eq("list_type", "leads")
        .gte("created_at", start)
        .lt("created_at", end);
      if (data.schoolIds && data.schoolIds.length > 0) lq = lq.in("school_id", data.schoolIds);
      const { data: leadSubs } = await lq;
      const schoolOf = new Map<string, string>();
      for (const r of leadSubs ?? []) schoolOf.set(r.id as string, (r.schools as { name?: string } | null)?.name ?? "—");
      const ids = [...schoolOf.keys()];
      const opps: { submission_id: string | null; funnel_id: string; stage_id: string; status: string; owner_confirmed_at: string | null; owner_id: string | null }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data: chunk } = await context.supabase
          .from("opportunities")
          .select("submission_id, funnel_id, stage_id, status, owner_confirmed_at, owner_id")
          .in("submission_id", ids.slice(i, i + 200));
        opps.push(...((chunk ?? []) as typeof opps));
      }
      const funnelIds = [...new Set(opps.map((o) => o.funnel_id))];
      const firstStage = new Map<string, string>();
      if (funnelIds.length) {
        const { data: stages } = await context.supabase
          .from("funnel_stages").select("id, funnel_id, position").in("funnel_id", funnelIds).order("position", { ascending: true });
        for (const st of (stages ?? []) as { id: string; funnel_id: string }[]) if (!firstStage.has(st.funnel_id)) firstStage.set(st.funnel_id, st.id);
      }
      const ownerIds = [...new Set(opps.map((o) => o.owner_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ownerIds.length) {
        const { data: profs } = await context.supabase.from("profiles").select("id, full_name").in("id", ownerIds);
        for (const pr of (profs ?? []) as { id: string; full_name: string | null }[]) names.set(pr.id, pr.full_name?.trim() || "Sem nome");
      }
      const m = new Map<string, Map<string, { count: number; started: number; won: number }>>();
      for (const sName of new Set(schoolOf.values())) m.set(sName, new Map());
      for (const s of bySchool.values()) if (!m.has(s.name)) m.set(s.name, new Map());
      for (const o of opps) {
        if (!o.submission_id) continue;
        const sName = schoolOf.get(o.submission_id) ?? "—";
        const label = o.owner_id ? names.get(o.owner_id) ?? "Sem nome" : "Sem responsável";
        const g = m.get(sName) ?? new Map();
        const e = g.get(label) ?? { count: 0, started: 0, won: 0 };
        e.count += 1;
        if (o.status === "won") e.won += 1;
        const fs = firstStage.get(o.funnel_id);
        if (o.status !== "open" || o.owner_confirmed_at || (fs && o.stage_id !== fs)) e.started += 1;
        g.set(label, e);
        m.set(sName, g);
      }
      leadOwnersBySchool = [...m.entries()]
        .map(([school, g]) => ({
          school,
          items: [...g.entries()].map(([label, v]) => ({ label, ...v }))
            .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label, "pt-BR")),
        }))
        .sort((x, y) => compareSchoolNames(x.school, y.school));
    }

    const seriesCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    const lossReasonCounts = new Map<string, number>();
    for (const loss of losses ?? []) {
      const reason = loss.crm_close_reasons as { label?: string } | null;
      const label = reason?.label?.trim() || "Sem motivo informado";
      lossReasonCounts.set(label, (lossReasonCounts.get(label) ?? 0) + 1);
    }

    // Soma das crianças e distribuição das respostas dos formulários.
    let children = 0;
    if (rows.length > 0) {
      const { CHILDREN_COUNT_LABEL, parseChildren } = await import("./model");
      const formIds = [...new Set(rows.map((r) => r.form_id))];
      const { data: fields } = await context.supabase
        .from("form_fields")
        .select("id, label, type, options, internal, position")
        .in("form_id", formIds)
        .order("position");

      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
      const countFieldIds = (fields ?? [])
        .filter((f) => f.internal && f.label === CHILDREN_COUNT_LABEL)
        .map((f) => f.id as string);
      const childrenFields = (fields ?? []).filter((f) => f.type === "children");
      const sourceFields = (fields ?? []).filter((f) =>
        normalize(f.label as string).includes("como conheceu"),
      );

      const responseFieldIds = [
        ...countFieldIds,
        ...childrenFields.map((f) => f.id as string),
        ...sourceFields.map((f) => f.id as string),
      ];
      if (responseFieldIds.length > 0) {
        const submissionIds = rows.map((r) => r.id as string);
        const values = await fetchValuesInBatches<{ submission_id: string; field_id: string; value: string | null; value_number: number | null }>(
          context.supabase, "submission_id, field_id, value, value_number", submissionIds, responseFieldIds,
        );

        const countIds = new Set(countFieldIds);
        const childrenIds = new Set(childrenFields.map((f) => f.id as string));
        const sourceIds = new Set(sourceFields.map((f) => f.id as string));
        const submissionSchools = new Map(
          rows.map((row) => [row.id as string, row.school_id as string]),
        );
        for (const v of values ?? []) {
          if (countIds.has(v.field_id as string)) {
            const childCount = Number(v.value_number ?? 0);
            children += childCount;
            const schoolId = submissionSchools.get(v.submission_id as string);
            const schoolEntry = schoolId ? bySchool.get(schoolId) : undefined;
            if (schoolEntry) schoolEntry.children += childCount;
            const date = submissionDate.get(v.submission_id as string);
            if (date) {
              monthlyChildren[date.month] = (monthlyChildren[date.month] ?? 0) + childCount;
              const key = `${date.month}-${date.day}`;
              const bucket = dailyBuckets.get(key) ?? { month: date.month, day: date.day, visits: 0, children: 0 };
              bucket.children += childCount;
              dailyBuckets.set(key, bucket);
            }
          }
          if (childrenIds.has(v.field_id as string)) {
            for (const child of parseChildren(v.value)) {
              const label = child.serie.trim();
              if (label) seriesCounts.set(label, (seriesCounts.get(label) ?? 0) + 1);
            }
          }
          if (sourceIds.has(v.field_id as string) && v.value) {
            let answers: string[] = [];
            try {
              const parsed = JSON.parse(v.value);
              answers = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch {
              answers = [v.value];
            }
            for (const answer of answers) {
              const label = answer.trim();
              if (label) sourceCounts.set(label, (sourceCounts.get(label) ?? 0) + 1);
            }
          }
        }
      }
    }

    // Bairros/cidades por unidade (campo do tipo Endereço, gravado em partes).
    type NeighborhoodItem = { label: string; city: string; count: number };
    const neighborhoods: { school: string; items: NeighborhoodItem[] }[] = [];
    if (rows.length > 0) {
      const submissionIds = rows.map((r) => r.id as string);
      const { data: addressValues } = await context.supabase
        .from("submission_values")
        .select("submission_id, part, value")
        .in("submission_id", submissionIds)
        .in("part", ["bairro", "cidade"]);

      const bairroBySub = new Map<string, string>();
      const cidadeBySub = new Map<string, string>();
      for (const v of addressValues ?? []) {
        const text = String(v.value ?? "").trim();
        if (!text) continue;
        if (v.part === "bairro") bairroBySub.set(v.submission_id as string, text);
        else cidadeBySub.set(v.submission_id as string, text);
      }

      const key = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const perSchool = new Map<
        string,
        {
          name: string;
          items: Map<string, { labels: Map<string, number>; city: string; count: number }>;
        }
      >();
      for (const row of rows) {
        const bairro = bairroBySub.get(row.id as string);
        if (!bairro) continue;
        const cidade = cidadeBySub.get(row.id as string) ?? "";
        const schoolId = row.school_id as string;
        const schoolName = (row.schools as { name?: string } | null)?.name ?? "—";
        const school = perSchool.get(schoolId) ?? { name: schoolName, items: new Map() };
        const k = `${key(bairro)}|${key(cidade)}`;
        const entry = school.items.get(k) ?? {
          labels: new Map<string, number>(),
          city: cidade,
          count: 0,
        };
        entry.count += 1;
        entry.labels.set(bairro, (entry.labels.get(bairro) ?? 0) + 1);
        school.items.set(k, entry);
        perSchool.set(schoolId, school);
      }

      for (const school of perSchool.values()) {
        const items = [...school.items.values()]
          .map((entry) => {
            const label = [...entry.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
            return { label, city: entry.city, count: entry.count };
          })
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
        const top = items.slice(0, 8);
        const rest = items.slice(8).reduce((total, item) => total + item.count, 0);
        if (rest > 0) top.push({ label: "Outros", city: "", count: rest });
        neighborhoods.push({ school: school.name, items: top });
      }
      neighborhoods.sort((a, b) => compareSchoolNames(a.school, b.school));
    }

    const enrolled = rows.reduce(
      (total, row) => total + (row.enrolled ? Number(row.enrollment_count ?? 0) : 0),
      0,
    );
    const orderedSeries = [...seriesCounts.entries()].sort(
      ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "pt-BR"),
    );

    return {
      year: campaignYear,
      visits: rows.length,
      children,
      series: orderedSeries.map(([label, count]) => ({ label, count })),
      enrollments: {
        total: enrolled,
        percentage: children > 0 ? Math.round((enrolled / children) * 1000) / 10 : 0,
      },
      sources: [...sourceCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      lossReasons: [...lossReasonCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      attendants: [...attendantCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      presenters: [...presenterCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      monthly: monthlyVisits.map((visits, month) => ({
        month,
        visits,
        children: monthlyChildren[month] ?? 0,
      })),
      daily: [...dailyBuckets.values()].sort((a, b) => a.month - b.month || a.day - b.day),
      neighborhoods,
      attendantsBySchool,
      leadOwnersBySchool,
      bySchool: [...bySchool.values()].sort((a, b) => compareSchoolNames(a.name, b.name)),
    };
  });

// ---------- Permissões do usuário logado ----------

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      ...perms,
      email: context.userEmail,
      fullName: profile?.full_name ?? "",
    };
  });

// ---------- Editar crianças e séries (Administrador e Gerente da unidade) ----------

export const updateSubmissionChildren = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        submission_id: z.string().uuid(),
        series: z.array(z.string().trim().min(1, "Informe a série de cada criança.").max(100)).min(1).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const admin = extAdmin();
    const { data: sub, error } = await admin
      .from("submissions")
      .select("id, school_id, form_id, children_count")
      .eq("id", data.submission_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub) throw new Error("Cadastro não encontrado.");
    if (!(perms.isAdmin || perms.managerSchools.includes(sub.school_id as string)))
      throw new Error("Sem permissão para editar este cadastro.");
    const { data: field } = await admin
      .from("form_fields")
      .select("id")
      .eq("form_id", sub.form_id)
      .eq("type", "children")
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!field) throw new Error("Este formulário não tem campo de crianças.");
    const { data: cur } = await admin
      .from("submission_values")
      .select("value")
      .eq("submission_id", sub.id)
      .eq("field_id", field.id)
      .eq("part", "")
      .maybeSingle();
    let list: { nome?: string; nascimento?: string; turno?: string; serie?: string }[] = [];
    try {
      const parsed = JSON.parse((cur?.value as string | null) ?? "[]");
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      /* ignora */
    }
    const before = list.map((c) => c?.serie ?? "").filter(Boolean).join(", ") || "—";
    const next = data.series.map((serie, i) => ({
      nome: list[i]?.nome ?? "",
      nascimento: list[i]?.nascimento ?? "",
      turno: list[i]?.turno ?? "",
      ...(list[i] ?? {}),
      serie,
    }));
    const value = JSON.stringify(next);
    const { error: vErr } = cur
      ? await admin.from("submission_values").update({ value }).eq("submission_id", sub.id).eq("field_id", field.id).eq("part", "")
      : await admin.from("submission_values").insert({ submission_id: sub.id, field_id: field.id, part: "", value });
    if (vErr) throw new Error(vErr.message);
    const now = new Date().toISOString();
    const { error: sErr } = await admin
      .from("submissions")
      .update({ children_count: next.length, updated_at: now, updated_by: context.userId })
      .eq("id", sub.id);
    if (sErr) throw new Error(sErr.message);
    await admin.from("audit_log").insert({
      submission_id: sub.id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        { field_id: "children_count", label: "Crianças", before: String(sub.children_count ?? "—"), after: String(next.length) },
        { field_id: field.id, label: "Séries", before, after: data.series.join(", ") },
      ],
    });
    return { ok: true };
  });

async function reconcileAfter(submissionId: string) {
  const { extAdmin, reconcileWonOpportunities } = await import("./server");
  await reconcileWonOpportunities(extAdmin(), [submissionId]);
}

// Administrador: retira o cadastro do funil (cartão arquivado, nada é apagado).
export const removeSubmissionFromFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ submission_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    if (!perms.isAdmin) throw new Error("Apenas o Administrador pode retirar o funil.");
    const admin = extAdmin();
    const { data: opps, error } = await admin
      .from("opportunities")
      .select("id, status, funnels(name)")
      .eq("submission_id", data.submission_id);
    if (error) throw new Error(error.message);
    if ((opps ?? []).some((o) => o.status === "won")) {
      throw new Error("Este cadastro já foi ganho (check-in ou matrícula) e não pode sair do funil.");
    }
    const now = new Date().toISOString();
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const author = (prof as { full_name?: string } | null)?.full_name || context.userEmail || "Administrador";
    const { error: subErr } = await admin
      .from("submissions")
      .update({ attendant_id: null, crm_status: "none", crm_reason: "Retirado do funil pelo Administrador", updated_at: now, updated_by: context.userId })
      .eq("id", data.submission_id);
    if (subErr) throw new Error(subErr.message);
    for (const o of (opps ?? []) as unknown as { id: string; funnels: { name: string } | null }[]) {
      await admin.from("crm_tasks").delete().eq("opportunity_id", o.id).eq("done", false);
      await admin.from("crm_notes").insert({
        opportunity_id: o.id,
        author_id: context.userId,
        author_name: author,
        body: `Cadastro retirado do funil ${o.funnels?.name ?? ""} por ${author}.`,
      });
      const { error: upd } = await admin
        .from("opportunities")
        .update({ status: "lost", submission_id: null, closed_at: now, close_note: "Retirado do funil pelo Administrador", updated_at: now })
        .eq("id", o.id);
      if (upd) throw new Error(upd.message);
    }
    return { ok: true };
  });

/** Lê submission_values em blocos e páginas (a API devolve no máximo 1000 linhas por consulta). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchValuesInBatches<T>(db: any, columns: string, submissionIds: string[], fieldIds: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < submissionIds.length; i += 150) {
    const chunk = submissionIds.slice(i, i + 150);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("submission_values").select(columns)
        .eq("part", "").in("submission_id", chunk).in("field_id", fieldIds)
        .order("submission_id").order("field_id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}
