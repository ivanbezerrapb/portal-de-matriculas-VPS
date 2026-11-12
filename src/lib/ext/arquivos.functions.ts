import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export const FILE_BUCKET = "central-arquivos";

export const BRANDS = ["conecta", "interactivo"] as const;
export type Brand = (typeof BRANDS)[number];

export const BRAND_LABELS: Record<Brand, string> = {
  conecta: "Conecta",
  interactivo: "Interactivo",
};

const brandSchema = z.enum(BRANDS);

export type FileCategory = {
  id: string;
  brand: Brand;
  name: string;
  position: number;
  active: boolean;
};

export type SharedFile = {
  id: string;
  brand: Brand;
  school_id: string | null;
  category_id: string | null;
  kind: "file" | "link";
  url: string | null;
  name: string;
  path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  schools?: { name: string } | null;
  file_categories?: { name: string } | null;
};

type Access = {
  isAdmin: boolean;
  viewBrands: Brand[];
  manageBrands: Brand[];
  schools: { id: string; name: string; brand: Brand }[];
};

// Marcas que o usuário pode ver e enviar, a partir das unidades vinculadas.
async function getAccess(
  supabase: Parameters<typeof import("./server").getPerms>[0],
  userId: string,
): Promise<Access> {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  const { data } = await supabase.from("schools").select("id, name, brand").order("name");
  const schools = ((data ?? []) as { id: string; name: string; brand: Brand }[]).filter(
    (s) => s.brand === "conecta" || s.brand === "interactivo",
  );

  if (perms.isAdmin) {
    return {
      isAdmin: true,
      viewBrands: [...BRANDS],
      manageBrands: [...BRANDS],
      schools,
    };
  }

  // Direção vê tudo, mas não envia nem exclui nada.
  if (perms.isDirecao) {
    return {
      isAdmin: false,
      viewBrands: [...BRANDS],
      manageBrands: [],
      schools,
    };
  }

  const mySchoolIds = new Set(perms.roles.map((r) => r.school_id).filter(Boolean) as string[]);
  const managerIds = new Set(perms.managerSchools);
  const viewBrands = [...new Set(schools.filter((s) => mySchoolIds.has(s.id)).map((s) => s.brand))];
  const manageBrands = [
    ...new Set(schools.filter((s) => managerIds.has(s.id)).map((s) => s.brand)),
  ];
  return {
    isAdmin: false,
    viewBrands,
    manageBrands,
    schools: schools.filter((s) => viewBrands.includes(s.brand)),
  };
}

export const getFileAccess = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => getAccess(context.supabase, context.userId));

export const listFileCategories = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ brand: brandSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("file_categories")
      .select("*")
      .eq("brand", data.brand)
      .eq("active", true)
      .order("position")
      .order("name");
    if (error) throw new Error(error.message);
    return (rows ?? []) as FileCategory[];
  });

export const createFileCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ brand: brandSchema, name: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: created, error } = await context.supabase
      .from("file_categories")
      .insert({ brand: data.brand, name: data.name.trim() })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await context.supabase
          .from("file_categories")
          .select("*")
          .eq("brand", data.brand)
          .ilike("name", data.name.trim())
          .maybeSingle();
        if (existing) return existing as FileCategory;
      }
      throw new Error(error.message);
    }
    return created as FileCategory;
  });

export const listFiles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        brand: brandSchema,
        school_id: z.string().uuid().optional(),
        category_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("shared_files")
      .select("*, schools(name), file_categories(name)")
      .eq("brand", data.brand)
      .order("created_at", { ascending: false });
    if (data.school_id) query = query.eq("school_id", data.school_id);
    if (data.category_id) query = query.eq("category_id", data.category_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as SharedFile[];
  });

export const createFileRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        brand: brandSchema,
        school_id: z.string().uuid().nullable().optional(),
        category_id: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(200),
        path: z.string().min(1),
        mime_type: z.string().optional().nullable(),
        size_bytes: z.number().int().nonnegative().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    if (!access.manageBrands.includes(data.brand)) {
      throw new Error("Você não tem permissão para enviar arquivos nesta marca.");
    }
    if (data.school_id) {
      const school = access.schools.find((s) => s.id === data.school_id);
      if (!school || school.brand !== data.brand) {
        throw new Error("Unidade inválida para esta marca.");
      }
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: created, error } = await context.supabase
      .from("shared_files")
      .insert({
        brand: data.brand,
        school_id: data.school_id ?? null,
        category_id: data.category_id ?? null,
        name: data.name.trim(),
        path: data.path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        uploaded_by: context.userId,
        uploaded_by_name:
          ((profile as { full_name?: string } | null)?.full_name ?? "") || context.userEmail,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created as SharedFile;
  });

export const createLinkRecord = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        brand: brandSchema,
        school_id: z.string().uuid().nullable().optional(),
        category_id: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(200),
        url: z
          .string()
          .trim()
          .min(5)
          .max(2000)
          .refine(
            (v) => /^https?:\/\//i.test(v),
            "O endereço deve começar com http:// ou https://",
          ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    if (!access.manageBrands.includes(data.brand)) {
      throw new Error("Você não tem permissão para adicionar links nesta marca.");
    }
    if (data.school_id) {
      const school = access.schools.find((s) => s.id === data.school_id);
      if (!school || school.brand !== data.brand) {
        throw new Error("Unidade inválida para esta marca.");
      }
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: created, error } = await context.supabase
      .from("shared_files")
      .insert({
        brand: data.brand,
        school_id: data.school_id ?? null,
        category_id: data.category_id ?? null,
        kind: "link",
        url: data.url.trim(),
        name: data.name.trim(),
        path: null,
        uploaded_by: context.userId,
        uploaded_by_name:
          ((profile as { full_name?: string } | null)?.full_name ?? "") || context.userEmail,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created as SharedFile;
  });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // A RLS garante que só quem pode ver o arquivo encontra a linha.
    const { data: row, error } = await context.supabase
      .from("shared_files")
      .select("path, name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Arquivo não encontrado.");

    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { data: signed, error: signError } = await admin.storage
      .from(FILE_BUCKET)
      .createSignedUrl(row.path as string, 60, { download: row.name as string });
    if (signError || !signed) throw new Error(signError?.message ?? "Falha ao gerar o link.");
    return { url: signed.signedUrl };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error: readError } = await context.supabase
      .from("shared_files")
      .select("id, path, brand, kind")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Arquivo não encontrado.");

    const access = await getAccess(context.supabase, context.userId);
    if (!access.manageBrands.includes(row.brand as Brand)) {
      throw new Error("Você não tem permissão para excluir este arquivo.");
    }

    const { error } = await context.supabase.from("shared_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row.kind !== "link" && row.path) {
      const { extAdmin } = await import("./server");
      await extAdmin()
        .storage.from(FILE_BUCKET)
        .remove([row.path as string]);
    }
    return { ok: true };
  });
