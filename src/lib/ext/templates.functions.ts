import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { mapFieldsByLabel, parseLayout, remapLayoutFields } from "./print-layout";

type Supa = { from: (t: string) => any };

const labelPair = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().optional(),
  internal: z.boolean().optional(),
});

const libraryInput = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  header_text: z.string().optional().nullable(),
  footer_text: z.string().optional().nullable(),
  show_logo: z.boolean(),
  columns: z.union([z.literal(1), z.literal(2)]),
  page_size: z.enum(["A4", "A5"]),
  show_signature: z.boolean(),
  layout: z.any().optional().nullable(),
  field_labels: z.array(labelPair),
  school_ids: z.array(z.string().uuid()),
  ref_form_id: z.string().uuid().optional().nullable(),
});

// Copia um template da biblioteca para um formulário, casando campos pelo rótulo.
async function applyToForm(supabase: Supa, lib: any, formId: string): Promise<void> {
  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, type, internal")
    .eq("form_id", formId)
    .order("position");

  const target = (fields ?? []) as {
    id: string;
    label: string;
    type: string;
    internal: boolean;
  }[];
  const sourceLabels = (lib.field_labels ?? []) as {
    id: string;
    label: string;
    type?: string;
    internal?: boolean;
  }[];
  const map = mapFieldsByLabel(sourceLabels, target);
  const sourceLayout = parseLayout(lib.layout);
  const targetChildrenId = target.find((field) => field.type === "children" && !field.internal)?.id;
  if (targetChildrenId) {
    for (const page of sourceLayout?.pages ?? []) {
      for (const block of page.blocks) {
        if (block.type === "children" && block.fieldId) {
          map[block.fieldId] = targetChildrenId;
        }
      }
    }
  }
  const layout = remapLayoutFields(sourceLayout, map);
  const mapped = [
    ...new Set(sourceLabels.map((s) => map[s.id]).filter((v): v is string => Boolean(v))),
  ];

  const payload = {
    form_id: formId,
    name: lib.name,
    title: lib.title,
    header_text: lib.header_text ?? null,
    footer_text: lib.footer_text ?? null,
    show_logo: lib.show_logo,
    columns: lib.columns,
    page_size: lib.page_size,
    show_signature: lib.show_signature,
    field_ids: mapped.length > 0 ? mapped : target.map((f) => f.id),
    layout,
    library_id: lib.id ?? null,
  };

  // Procura primeiro pelo vínculo com o template; senão, por nome (registros antigos).
  let existingId: string | null = null;
  if (lib.id) {
    const { data: linked } = await supabase
      .from("print_templates")
      .select("id")
      .eq("form_id", formId)
      .eq("library_id", lib.id)
      .maybeSingle();
    existingId = linked?.id ?? null;
  }
  if (!existingId) {
    const { data: byName } = await supabase
      .from("print_templates")
      .select("id")
      .eq("form_id", formId)
      .eq("name", lib.name)
      .is("library_id", null)
      .maybeSingle();
    existingId = byName?.id ?? null;
  }

  if (existingId) {
    const { error } = await supabase.from("print_templates").update(payload).eq("id", existingId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("print_templates").insert(payload);
    if (error) throw new Error(error.message);
  }
}

// Formulários que já usam este template da biblioteca.
async function linkedFormIds(supabase: Supa, libId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("print_templates")
    .select("form_id")
    .eq("library_id", libId);
  if (error) throw new Error(error.message);
  return [...new Set(((data ?? []) as { form_id: string }[]).map((r) => r.form_id))];
}

async function schoolFormIds(supabase: Supa, schoolIds: string[]): Promise<string[]> {
  if (schoolIds.length === 0) return [];
  const { data, error } = await supabase.from("forms").select("id").in("school_id", schoolIds);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((f) => f.id);
}

// Reaplica o template em todos os formulários vinculados + escolas marcadas.
async function propagate(supabase: Supa, lib: any, schoolIds: string[]): Promise<number> {
  const ids = [
    ...new Set([
      ...(await linkedFormIds(supabase, lib.id)),
      ...(await schoolFormIds(supabase, schoolIds)),
    ]),
  ];
  for (const formId of ids) {
    await applyToForm(supabase, lib, formId);
  }
  return ids.length;
}

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("print_template_library")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid().optional() }).merge(libraryInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      title: data.title,
      header_text: data.header_text || null,
      footer_text: data.footer_text || null,
      show_logo: data.show_logo,
      columns: data.columns,
      page_size: data.page_size,
      show_signature: data.show_signature,
      layout: data.layout ?? null,
      field_labels: data.field_labels,
      school_ids: data.school_ids,
      ref_form_id: data.ref_form_id ?? null,
      updated_at: new Date().toISOString(),
    };

    let saved: any;
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("print_template_library")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      saved = row;
    } else {
      const { data: row, error } = await context.supabase
        .from("print_template_library")
        .insert({ ...payload, created_by: context.userId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      saved = row;
    }

    const applied = await propagate(context.supabase as unknown as Supa, saved, data.school_ids);
    return { template: saved, applied };
  });

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("print_template_library")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: created, error: insErr } = await context.supabase
      .from("print_template_library")
      .insert({
        name: data.name,
        title: src.title,
        header_text: src.header_text,
        footer_text: src.footer_text,
        show_logo: src.show_logo,
        columns: src.columns,
        page_size: src.page_size,
        show_signature: src.show_signature,
        layout: src.layout,
        field_labels: src.field_labels,
        ref_form_id: src.ref_form_id ?? null,
        school_ids: [],
        created_by: context.userId,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    return created;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("print_template_library")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Usa um template da biblioteca dentro de um formulário específico.
export const applyTemplateToForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        template_id: z.string().uuid(),
        form_id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: lib, error } = await context.supabase
      .from("print_template_library")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (error) throw new Error(error.message);
    await applyToForm(context.supabase as unknown as Supa, lib, data.form_id);
    return { ok: true };
  });

// Envia um modelo já criado dentro de um formulário para a biblioteca.
export const saveFormTemplateAsLibrary = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        print_template_id: z.string().uuid(),
        name: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: tpl, error } = await context.supabase
      .from("print_templates")
      .select("*")
      .eq("id", data.print_template_id)
      .single();
    if (error) throw new Error(error.message);

    const { data: fields } = await context.supabase
      .from("form_fields")
      .select("id, label, type, internal")
      .eq("form_id", tpl.form_id)
      .order("position");

    const { data: created, error: insErr } = await context.supabase
      .from("print_template_library")
      .insert({
        name: data.name,
        title: tpl.title,
        header_text: tpl.header_text,
        footer_text: tpl.footer_text,
        show_logo: tpl.show_logo,
        columns: tpl.columns,
        page_size: tpl.page_size,
        show_signature: tpl.show_signature,
        layout: tpl.layout,
        field_labels: fields ?? [],
        ref_form_id: tpl.form_id,
        school_ids: [],
        created_by: context.userId,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // Vincula o modelo de origem ao template criado, para receber atualizações.
    await context.supabase
      .from("print_templates")
      .update({ library_id: created.id })
      .eq("id", data.print_template_id);

    return created;
  });
