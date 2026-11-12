import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

// ---------- Impressão ----------

// Lista modelos de impressão disponíveis (RLS limita por perfil/escola).
export const listPrintTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ form_id: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("print_templates")
      .select("id, form_id, name, page_size, columns")
      .order("name");
    if (data.form_id) query = query.eq("form_id", data.form_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows;
  });

// Dados completos para impressão: modelo + cadastros + campos + valores.
// O RLS do cliente do usuário já limita operadores/gestores à própria escola.
export const getPrintData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        template_id: z.string().uuid(),
        submission_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase
      .from("print_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (error) throw new Error(error.message);

    const { data: form } = await context.supabase
      .from("forms")
      .select("id, title, school_id, schools(name, logo_url)")
      .eq("id", template.form_id)
      .single();
    if (!form) throw new Error("Formulário não encontrado.");

    const { data: fields } = await context.supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", template.form_id)
      .order("position");

    const { data: submissions } = await context.supabase
      .from("submissions")
      .select("*")
      .in("id", data.submission_ids)
      .order("public_id");

    const { data: values } = await context.supabase
      .from("submission_values")
      .select("*")
      .eq("part", "")
      .in("submission_id", data.submission_ids);

    const orderedFields = (() => {
      const all = fields ?? [];
      const wanted = (template.field_ids ?? []) as string[];
      if (wanted.length === 0) return all;
      const map = new Map(all.map((f) => [f.id, f]));
      return wanted.map((id) => map.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
    })();

    return {
      template,
      form,
      fields: orderedFields,
      // Todos os campos do formulário: o layout precisa deles para achar
      // blocos dinâmicos (ex.: lista de crianças) mesmo quando o modelo veio
      // de outro formulário e a lista salva não inclui o campo.
      allFields: fields ?? [],
      submissions: (submissions ?? []).map((s) => ({
        ...s,
        values: Object.fromEntries(
          (values ?? [])
            .filter((v) => v.submission_id === s.id)
            .map((v) => [v.field_id, v.value ?? ""]),
        ),
      })),
    };
  });
