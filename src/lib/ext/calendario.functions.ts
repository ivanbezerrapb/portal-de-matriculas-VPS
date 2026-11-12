import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { findStageByKind } from "./model";

export type CalendarEvent = {
  id: string;
  at: string;
  title: string;
  school_id: string;
  school_name: string;
  phone: string | null;
  funnel_id: string;
  submission_id: string;
  checked_in_at: string | null;
  status: "scheduled" | "done" | "missed";
  can_check_in: boolean;
  kind: "visita" | "matricula";
  series?: string[];
};

function norm(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Visitas agendadas nos cartões de LEADS, com situação do check-in.
export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const admin = extAdmin();
    const { reconcileWonOpportunities } = await import("./server");
    await reconcileWonOpportunities(admin).catch(() => []);
    const all = perms.isAdmin || perms.isDirecao;
    const own = [...new Set([...perms.managerSchools, ...perms.infoSchools, ...perms.operatorSchools])];

    let schoolsQ = admin.from("schools").select("id, name").order("name");
    if (!all) schoolsQ = schoolsQ.in("id", own.length ? own : ["00000000-0000-0000-0000-000000000000"]);
    const { data: schools } = await schoolsQ;
    const schoolList = (schools ?? []) as { id: string; name: string }[];
    const schoolIds = schoolList.map((s) => s.id);
    const schoolName = new Map(schoolList.map((s) => [s.id, s.name]));
    if (schoolIds.length === 0) return { schools: [], events: [] as CalendarEvent[] };

    const { data: opps } = await admin
      .from("opportunities")
      .select("id, name, phone, visit_at, school_id, funnel_id, submission_id, submissions!inner(public_id, form_id, list_type, enrolled, enrolled_at)")
      .not("visit_at", "is", null)
      .in("school_id", schoolIds)
      .gte("visit_at", data.from)
      .lt("visit_at", data.to);
    type Opp = {
      id: string; name: string; phone: string | null; visit_at: string; school_id: string;
      funnel_id: string; submission_id: string;
      submissions: { public_id: string; form_id: string; list_type: string | null; enrolled: boolean | null; enrolled_at: string | null };
    };
    const fullSchools = new Set([...perms.managerSchools, ...perms.operatorSchools]);
    const rows = ((opps ?? []) as unknown as Opp[]).filter((o) => {
      if (all || fullSchools.has(o.school_id)) return true;
      // Central de Informações: todos os agendamentos das suas unidades (somente visualização).
      return perms.infoSchools.includes(o.school_id);
    });
    const subIds = rows.map((o) => o.submission_id);

    const checkIns = new Map<string, string>();
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    const seriesBySub = new Map<string, string[]>();
    if (subIds.length) {
      const { data: checks } = await admin
        .from("audit_log")
        .select("submission_id, created_at")
        .eq("action", "check_in")
        .in("submission_id", subIds);
      for (const c of (checks ?? []) as { submission_id: string; created_at: string }[]) checkIns.set(c.submission_id, c.created_at);

      const formBySub = new Map(rows.map((o) => [o.submission_id, o.submissions.form_id]));
      const formIds = [...new Set(formBySub.values())];
      const [{ data: dests }, { data: fields }] = await Promise.all([
        admin.from("form_destinations").select("form_id, name_field_id, phone_field_id").in("form_id", formIds),
        admin.from("form_fields").select("id, form_id, label, type").in("form_id", formIds),
      ]);
      const nameField = new Map<string, string>();
      const phoneField = new Map<string, string>();
      for (const d of (dests ?? []) as { form_id: string; name_field_id: string | null; phone_field_id: string | null }[]) {
        if (d.name_field_id) nameField.set(d.form_id, d.name_field_id);
        if (d.phone_field_id) phoneField.set(d.form_id, d.phone_field_id);
      }
      for (const f of (fields ?? []) as { id: string; form_id: string; label: string; type: string }[]) {
        if (!nameField.get(f.form_id) && f.type !== "children" && f.type !== "address" && norm(f.label).startsWith("nome"))
          nameField.set(f.form_id, f.id);
        if (!phoneField.get(f.form_id) && f.type === "phone") phoneField.set(f.form_id, f.id);
      }
      const seriesFields = new Map<string, string>();
      for (const f of (fields ?? []) as { id: string; form_id: string; label: string; type: string }[]) {
        const l = norm(f.label);
        if (f.type === "children" || l === "serie" || l === "series" || l.includes("serie de interesse")) seriesFields.set(f.id, f.type);
      }
      const wanted = [...new Set([...nameField.values(), ...phoneField.values(), ...seriesFields.keys()])];
      const { parseChildren } = await import("./model");
      if (wanted.length) {
        const { data: vals } = await admin
          .from("submission_values")
          .select("submission_id, field_id, value")
          .in("submission_id", subIds)
          .in("field_id", wanted)
          .eq("part", "");
        for (const v of (vals ?? []) as { submission_id: string; field_id: string; value: string | null }[]) {
          const form = formBySub.get(v.submission_id);
          if (!form || !v.value?.trim()) continue;
          if (nameField.get(form) === v.field_id) names.set(v.submission_id, v.value.trim());
          if (phoneField.get(form) === v.field_id) phones.set(v.submission_id, v.value.trim());
          const st = seriesFields.get(v.field_id);
          if (st) {
            const found = st === "children"
              ? parseChildren(v.value).map((c) => c.serie.trim())
              : v.value.split(/[,;\n]/).map((x) => x.trim());
            const cur = seriesBySub.get(v.submission_id) ?? [];
            cur.push(...found.filter(Boolean));
            seriesBySub.set(v.submission_id, cur);
          }
        }
      }
    }

    const now = Date.now();
    const events: CalendarEvent[] = rows.map((o) => {
      const isVisit = o.submissions.list_type === "leads";
      const checked = isVisit
        ? checkIns.get(o.submission_id) ?? null
        : o.submissions.enrolled ? o.submissions.enrolled_at ?? o.visit_at : null;
      const name = names.get(o.submission_id) ?? o.name;
      const status: CalendarEvent["status"] = checked
        ? "done"
        : new Date(o.visit_at).getTime() < new Date(new Date(now).toDateString()).getTime()
          ? "missed"
          : "scheduled";
      return {
        id: o.id,
        kind: isVisit ? "visita" : "matricula",
        series: seriesBySub.get(o.submission_id) ?? [],
        at: o.visit_at,
        title: name && name !== o.submissions.public_id ? `${o.submissions.public_id} · ${name}` : o.submissions.public_id,
        school_id: o.school_id,
        school_name: schoolName.get(o.school_id) ?? "",
        phone: o.phone ?? phones.get(o.submission_id) ?? null,
        funnel_id: o.funnel_id,
        submission_id: o.submission_id,
        checked_in_at: checked,
        status,
        can_check_in:
          !checked && (perms.isAdmin || perms.managerSchools.includes(o.school_id) || perms.operatorSchools.includes(o.school_id)),
      };
    });
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { schools: schoolList, events };
  });

// Cliente faltou: registra no histórico, apaga a data e move para "Reagendar visita".
export const markVisitNoShow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ opportunity_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const admin = extAdmin();
    const { data: opp, error } = await admin
      .from("opportunities")
      .select("id, school_id, funnel_id, visit_at, status, submissions(list_type)")
      .eq("id", data.opportunity_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) throw new Error("Cartão não encontrado.");
    const o = opp as unknown as {
      id: string; school_id: string; funnel_id: string; visit_at: string | null; status: string;
      submissions: { list_type: string | null } | null;
    };
    const allowed = perms.isAdmin || perms.managerSchools.includes(o.school_id) || perms.operatorSchools.includes(o.school_id);
    if (!allowed) throw new Error("Sem permissão para marcar falta.");
    const isVisit = o.submissions?.list_type === "leads";
    if (!o.submissions?.list_type) throw new Error("Cartão sem cadastro vinculado.");
    if (!o.visit_at) throw new Error("Este cartão não tem agendamento.");

    const { data: stages } = await admin.from("funnel_stages").select("id, name, kind").eq("funnel_id", o.funnel_id);
    const list = (stages ?? []) as { id: string; name: string; kind: string | null }[];
    const stage =
      findStageByKind(list, isVisit ? "reagendar_visita" : "reagendar_matricula") ??
      list.find((s) => !s.kind && norm(s.name).includes("reagend"));
    if (!stage) throw new Error(isVisit ? "Crie a etapa Reagendar visita neste funil." : "Crie a etapa Reagendar Matrícula neste funil.");

    const { data: last } = await admin
      .from("opportunities").select("position").eq("stage_id", stage.id)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("opportunities")
      .update({ stage_id: stage.id, visit_at: null, position: ((last?.position as number | undefined) ?? -1) + 1, updated_at: now })
      .eq("id", o.id);
    if (upErr) throw new Error(upErr.message);

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const authorName = ((profile?.full_name as string | null) ?? "") || context.userEmail || "Usuário";
    const when = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(o.visit_at)).replace(",", " às");
    const { error: noteErr } = await admin.from("crm_notes").insert({
      opportunity_id: o.id,
      author_id: context.userId,
      author_name: authorName,
      body: `Faltou à ${isVisit ? "visita agendada" : "matrícula agendada"} para ${when}. Aguardando reagendamento.`,
    });
    if (noteErr) throw new Error(noteErr.message);
    return { ok: true };
  });

// Matrícula agendada realizada: ganho, etapa "Matriculado", tarefas concluídas e histórico.
export const markEnrollmentDone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ opportunity_id: z.string().uuid(), count: z.number().int().positive() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const admin = extAdmin();
    const { data: opp, error } = await admin
      .from("opportunities")
      .select("id, school_id, funnel_id, visit_at, submission_id, submissions(list_type, enrolled, enrollment_count)")
      .eq("id", data.opportunity_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) throw new Error("Cartão não encontrado.");
    const o = opp as unknown as {
      id: string; school_id: string; funnel_id: string; visit_at: string | null; submission_id: string | null;
      submissions: { list_type: string | null; enrolled: boolean | null; enrollment_count: number | null } | null;
    };
    const allowed = perms.isAdmin || perms.managerSchools.includes(o.school_id) || perms.operatorSchools.includes(o.school_id);
    if (!allowed) throw new Error("Sem permissão para confirmar a matrícula.");
    if (!o.submission_id || o.submissions?.list_type === "leads") throw new Error("Disponível apenas para Pós Visita.");
    if (o.submissions?.enrolled) throw new Error("Esta matrícula já foi confirmada.");

    const now = new Date().toISOString();
    const { error: subErr } = await admin
      .from("submissions")
      .update({ enrolled: true, enrollment_count: data.count, enrolled_at: now, enrolled_by: context.userId, updated_at: now, updated_by: context.userId })
      .eq("id", o.submission_id);
    if (subErr) throw new Error(subErr.message);

    await admin.from("crm_tasks").update({ done: true, done_at: now }).eq("opportunity_id", o.id).eq("done", false);

    const [{ data: reason }, { data: stages }] = await Promise.all([
      admin.from("crm_close_reasons").select("id").eq("kind", "won").eq("label", "Matrícula realizada").maybeSingle(),
      admin.from("funnel_stages").select("id, name, kind").eq("funnel_id", o.funnel_id),
    ]);
    const stage = findStageByKind((stages ?? []) as { id: string; name: string; kind: string | null }[], "matriculado");
    const { error: upErr } = await admin
      .from("opportunities")
      .update({
        status: "won",
        close_reason_id: (reason?.id as string | undefined) ?? null,
        close_note: "Matrícula confirmada no Calendário.",
        closed_at: now,
        updated_at: now,
        ...(stage ? { stage_id: stage.id } : {}),
      })
      .eq("id", o.id);
    if (upErr) throw new Error(upErr.message);

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const authorName = ((profile?.full_name as string | null) ?? "") || context.userEmail || "Usuário";
    const when = o.visit_at
      ? new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        }).format(new Date(o.visit_at)).replace(",", " às")
      : "";
    await admin.from("crm_notes").insert({
      opportunity_id: o.id,
      author_id: context.userId,
      author_name: authorName,
      body: `Matriculado${when ? ` na matrícula agendada para ${when}` : ""}. Quantidade de matrículas: ${data.count}.`,
    });
    await admin.from("audit_log").insert({
      submission_id: o.submission_id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        { field_id: "enrolled", label: "Matrícula", before: "Não", after: "Sim" },
        { field_id: "enrollment_count", label: "Quantidade de matrículas", before: String(o.submissions?.enrollment_count ?? 0), after: String(data.count) },
      ],
    });
    return { ok: true };
  });
