import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------- Área pública (sem login) ----------

// Busca um formulário publicado pelo slug do link público.
// Usa o cliente anônimo: o RLS só expõe formulários com status "published",
// e aqui projetamos apenas campos não-internos.
export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    if (!/^[a-z0-9-]{1,120}$/i.test(data.slug)) return null;
    const { extAnon } = await import("./server");
    const supabase = extAnon();

    const { data: form, error } = await supabase
      .from("forms")
      .select("id, title, description, status, schools(name, logo_url)")
      .eq("public_slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) return null;

    const { data: fields, error: fieldsError } = await supabase
      .from("form_fields")
      .select("id, label, help_text, type, options, required, position")
      .eq("form_id", form.id)
      .eq("internal", false)
      .order("position");
    if (fieldsError) throw new Error(fieldsError.message);

    return { form, fields: fields ?? [] };
  });

// Envia um preenchimento público. Valida obrigatórios no servidor,
// gera o ID sequencial da escola e grava tudo.
export const submitPublicForm = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i),
        values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { extAdmin } = await import("./server");
    const supabase = extAdmin();

    const { data: form } = await supabase
      .from("forms")
      .select("id, school_id, status, list_type")
      .eq("public_slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!form) throw new Error("Formulário não disponível.");

    const { data: fields } = await supabase
      .from("form_fields")
      .select("id, label, type, required")
      .eq("form_id", form.id)
      .eq("internal", false);
    const publicFields = fields ?? [];

    const { MAX_CHILDREN, parseChildren } = await import("./model");

    let childrenCount: number | null = null;

    for (const field of publicFields) {
      const v = data.values[field.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (field.required && empty) {
        throw new Error(`O campo "${field.label}" é obrigatório.`);
      }
      if (field.type === "children" && !empty) {
        const list = parseChildren(typeof v === "string" ? v : "");
        childrenCount = list.length;
        if (list.length === 0 || list.length > MAX_CHILDREN) {
          throw new Error(`Informe de 1 a ${MAX_CHILDREN} crianças em "${field.label}".`);
        }
        if (field.required) {
          list.forEach((c, i) => {
            if (!c.nome.trim() || !c.nascimento || !c.serie || !c.turno) {
              throw new Error(
                `Preencha nome, data de nascimento, série e turno da criança ${i + 1} em "${field.label}".`,
              );
            }
          });
        }
      }
    }

    const listType = form.list_type === "leads" ? "leads" : "visitantes";
    const { data: publicId, error: idError } = await supabase.rpc(
      listType === "leads" ? "next_school_lead_id" : "next_school_public_id",
      { p_school_id: form.school_id },
    );
    if (idError || !publicId) {
      throw new Error(idError?.message ?? "Falha ao gerar o ID do cadastro.");
    }

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        form_id: form.id,
        school_id: form.school_id,
        public_id: publicId,
        list_type: listType,
        children_count: childrenCount,
      })
      .select("id")
      .single();
    if (subError) throw new Error(subError.message);

    const { addressPartRows } = await import("./model");
    const rows = publicFields
      .filter((f) => data.values[f.id] != null)
      .flatMap((f) => {
        const value = Array.isArray(data.values[f.id])
          ? JSON.stringify(data.values[f.id])
          : String(data.values[f.id]).trim();
        const main = { submission_id: submission.id, field_id: f.id, part: "", value };
        // Endereço: grava também cada parte (CEP, Rua, Número...) separadamente.
        if (f.type === "address" && value) {
          return [main, ...addressPartRows(submission.id, f.id, value)];
        }
        return [main];
      });
    if (rows.length > 0) {
      const { error: valuesError } = await supabase.from("submission_values").insert(rows);
      if (valuesError) throw new Error(valuesError.message);
    }

    // Aplica as regras de destino (funil/etapa) configuradas no formulário.
    try {
      const { applyDestination } = await import("./destino.server");
      await applyDestination(supabase, {
        submissionId: submission.id,
        formId: form.id,
        schoolId: form.school_id,
        publicId: publicId as string,
        values: data.values,
      });
    } catch {
      // O cadastro já foi salvo; falha ao criar a oportunidade não bloqueia o envio.
    }

    if (childrenCount !== null) {
      const { writeChildrenCountValue } = await import("./server");
      await writeChildrenCountValue(supabase, form.id, submission.id, childrenCount);
    }

    return { publicId };
  });
