import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export const listForms = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("forms")
      .select("*, schools(name), form_destinations(enabled)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getForm = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: form, error }, { data: fields }, { data: templates }] = await Promise.all([
      context.supabase.from("forms").select("*, schools(name)").eq("id", data.id).single(),
      context.supabase.from("form_fields").select("*").eq("form_id", data.id).order("position"),
      context.supabase
        .from("print_templates")
        .select("*")
        .eq("form_id", data.id)
        .order("created_at"),
    ]);
    if (error) throw new Error(error.message);
    return { form, fields: fields ?? [], templates: templates ?? [] };
  });

export const createForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        school_id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().optional(),
        list_type: z.enum(["visitantes", "leads"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: created, error } = await context.supabase
      .from("forms")
      .insert({
        school_id: data.school_id,
        title: data.title,
        description: data.description || null,
        list_type: data.list_type ?? "visitantes",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const duplicateForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(2),
        school_id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: source, error: srcErr } = await context.supabase
      .from("forms")
      .select("*")
      .eq("id", data.id)
      .single();
    if (srcErr) throw new Error(srcErr.message);

    const { data: created, error } = await context.supabase
      .from("forms")
      .insert({
        school_id: data.school_id,
        title: data.title,
        description: source.description ?? null,
        list_type: source.list_type ?? "visitantes",
        status: "draft",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { data: fields, error: fieldsErr } = await context.supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", data.id)
      .order("position");
    if (fieldsErr) throw new Error(fieldsErr.message);

    const idMap = new Map<string, string>();
    for (const f of fields ?? []) {
      const { data: newField, error: insErr } = await context.supabase
        .from("form_fields")
        .insert({
          form_id: created.id,
          label: f.label,
          help_text: f.help_text,
          type: f.type,
          options: f.options,
          required: f.required,
          internal: f.internal,
          position: f.position,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      idMap.set(f.id, newField.id);
    }

    const { data: templates, error: tplErr } = await context.supabase
      .from("print_templates")
      .select("*")
      .eq("form_id", data.id)
      .order("created_at");
    if (tplErr) throw new Error(tplErr.message);

    for (const t of templates ?? []) {
      const { error: insErr } = await context.supabase.from("print_templates").insert({
        form_id: created.id,
        name: t.name,
        title: t.title,
        header_text: t.header_text,
        footer_text: t.footer_text,
        show_logo: t.show_logo,
        columns: t.columns,
        page_size: t.page_size,
        show_signature: t.show_signature,
        field_ids: ((t.field_ids ?? []) as string[])
          .map((fid) => idMap.get(fid))
          .filter((v): v is string => Boolean(v)),
      });
      if (insErr) throw new Error(insErr.message);
    }

    return created;
  });

export const updateFormInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forms")
      .update({ title: data.title, description: data.description || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFormStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "closed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const update: Record<string, unknown> = { status: data.status };

    if (data.status === "published") {
      const { data: form } = await context.supabase
        .from("forms")
        .select("title, public_slug")
        .eq("id", data.id)
        .single();
      if (form?.title) {
        const slug = await uniqueSlug(context.supabase, slugify(form.title), data.id);
        if (slug && slug !== form["public_slug"]) update["public_slug"] = slug;
      }
    }

    const { error } = await context.supabase.from("forms").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RESERVED_SLUGS = new Set([
  "auth",
  "api",
  "f",
  "apresentacao",
  "arquivos",
  "bancos-anteriores",
  "cadastros",
  "crm",
  "dashboard",
  "escolas",
  "formularios",
  "imprimir",
  "leads",
  "templates",
  "usuarios",
  "assets",
  "public",
]);

function slugify(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(
  supabase: { from: (t: string) => any },
  base: string,
  formId: string,
): Promise<string | null> {
  if (!base) return null;
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const { data: taken } = await supabase
      .from("forms")
      .select("id")
      .eq("public_slug", candidate)
      .neq("id", formId)
      .maybeSingle();
    if (!taken) return candidate;
  }
  return null;
}

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Campos ----------

const fieldInput = z.object({
  label: z.string().min(1),
  help_text: z.string().optional().nullable(),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "date",
    "single_choice",
    "multiple_choice",
    "yes_no",
    "email",
    "phone",
    "children",
    "address",
  ]),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean(),
  internal: z.boolean(),
  position: z.number().int(),
});

export const saveFormFields = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        form_id: z.string().uuid(),
        fields: z.array(fieldInput.merge(z.object({ id: z.string() }))),
        deleted_ids: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Remove campos excluídos
    if (data.deleted_ids.length > 0) {
      const { error } = await context.supabase
        .from("form_fields")
        .delete()
        .in("id", data.deleted_ids);
      if (error) throw new Error(error.message);
    }
    for (const field of data.fields) {
      const payload = {
        form_id: data.form_id,
        label: field.label,
        help_text: field.help_text || null,
        type: field.type,
        options: field.options ?? null,
        required: field.required,
        internal: field.internal,
        position: field.position,
      };
      if (field.id.startsWith("new-")) {
        const { error } = await context.supabase.from("form_fields").insert(payload);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase
          .from("form_fields")
          .update(payload)
          .eq("id", field.id);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

// ---------- Modelos de impressão ----------

const templateInput = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  header_text: z.string().optional().nullable(),
  footer_text: z.string().optional().nullable(),
  show_logo: z.boolean(),
  columns: z.union([z.literal(1), z.literal(2)]),
  page_size: z.enum(["A4", "A5"]),
  show_signature: z.boolean(),
  field_ids: z.array(z.string()),
  layout: z.any().optional().nullable(),
});

export const savePrintTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().optional(),
        form_id: z.string().uuid(),
      })
      .merge(templateInput)
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      form_id: data.form_id,
      name: data.name,
      title: data.title,
      header_text: data.header_text || null,
      footer_text: data.footer_text || null,
      show_logo: data.show_logo,
      columns: data.columns,
      page_size: data.page_size,
      show_signature: data.show_signature,
      field_ids: data.field_ids,
      layout: data.layout ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("print_templates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("print_templates").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const duplicatePrintTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("print_templates")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { error: insErr } = await context.supabase.from("print_templates").insert({
      form_id: src.form_id,
      name: data.name,
      title: src.title,
      header_text: src.header_text,
      footer_text: src.footer_text,
      show_logo: src.show_logo,
      columns: src.columns,
      page_size: src.page_size,
      show_signature: src.show_signature,
      field_ids: src.field_ids,
      layout: src.layout,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const deletePrintTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("print_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
