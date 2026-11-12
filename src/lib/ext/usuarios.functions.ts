import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

// ---------- Gestão de usuários (somente Administrador) ----------

async function requireAdmin(supabase: any, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores.");
  return perms;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    const { data: authData, error } = await admin.auth.admin.listUsers({
      perPage: 500,
    });
    if (error) throw new Error(error.message);

    const [{ data: roles }, { data: profiles }, { data: userFunnels }] = await Promise.all([
      admin.from("user_roles").select("user_id, role, school_id"),
      admin.from("profiles").select("id, full_name, must_change_password"),
      admin.from("user_funnels").select("user_id, funnel_id"),
    ]);
    const funnelMap = new Map<string, string[]>();
    for (const uf of (userFunnels ?? []) as { user_id: string; funnel_id: string }[]) {
      const list = funnelMap.get(uf.user_id) ?? [];
      list.push(uf.funnel_id);
      funnelMap.set(uf.user_id, list);
    }
    const roleMap = new Map<string, { role: string; school_id: string | null }[]>();
    for (const r of roles ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push({ role: r.role, school_id: r.school_id });
      roleMap.set(r.user_id, list);
    }
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const mustMap = new Map(
      ((profiles ?? []) as { id: string; must_change_password?: boolean }[]).map((p) => [p.id, !!p.must_change_password]),
    );

    return authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: nameMap.get(u.id) ?? "",
      created_at: u.created_at,
      roles: roleMap.get(u.id) ?? [],
      funnel_ids: funnelMap.get(u.id) ?? [],
      must_change_password: mustMap.get(u.id) ?? false,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        role: z.enum(["admin", "school_manager", "print_operator", "info_center", "direcao"]),
        school_id: z.string().uuid().optional().nullable(),
        funnel_ids: z.array(z.string().uuid()).optional(),
        must_change_password: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);

    const needsSchool =
      data.role === "school_manager" ||
      data.role === "print_operator" ||
      data.role === "info_center";
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.role,
      school_id: needsSchool ? data.school_id : null,
    });
    if (roleError) throw new Error(roleError.message);

    if (data.must_change_password) {
      await admin
        .from("profiles")
        .upsert({ id: created.user.id, full_name: data.full_name, must_change_password: true });
    }

    // Central de Informações trabalha apenas nos funis atribuídos.
    if (data.role === "info_center" && data.funnel_ids?.length) {
      const { error: funnelError } = await admin
        .from("user_funnels")
        .insert(data.funnel_ids.map((id) => ({ user_id: created.user.id, funnel_id: id })));
      if (funnelError) throw new Error(funnelError.message);
    }

    return { ok: true };
  });

// Define a lista completa de funis de um usuário Central de Informações.
export const setUserFunnels = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        funnel_ids: z.array(z.string().uuid()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    const { error: delError } = await admin
      .from("user_funnels")
      .delete()
      .eq("user_id", data.user_id);
    if (delError) throw new Error(delError.message);

    if (data.funnel_ids.length) {
      const { error } = await admin
        .from("user_funnels")
        .insert(data.funnel_ids.map((id) => ({ user_id: data.user_id, funnel_id: id })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "school_manager", "print_operator", "info_center", "direcao"]),
        school_id: z.string().uuid().optional().nullable(),
        action: z.enum(["add", "remove"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    if (data.action === "add") {
      const needsSchool =
        data.role === "school_manager" ||
        data.role === "print_operator" ||
        data.role === "info_center";
      const { error } = await admin.from("user_roles").upsert(
        {
          user_id: data.user_id,
          role: data.role,
          school_id: needsSchool ? data.school_id : null,
        },
        { onConflict: "user_id,role,school_id" },
      );
      if (error) throw new Error(error.message);
    } else {
      let q = admin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
      q = data.school_id ? q.eq("school_id", data.school_id) : q.is("school_id", null);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    // Remove vínculos com funis para não sobrar "Sem nome" como responsável.
    await admin.from("user_funnels").delete().eq("user_id", data.user_id);
    return { ok: true };
  });

// ---------- Troca obrigatória de senha ----------

export const setMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ user_id: z.string().uuid(), value: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { error } = await extAdmin()
      .from("profiles")
      .update({ must_change_password: data.value })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(6),
        must_change_password: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { error } = await admin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin
      .from("profiles")
      .update({ must_change_password: data.must_change_password })
      .eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });

export const getMyPasswordStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { extAdmin } = await import("./server");
    const { data } = await extAdmin()
      .from("profiles")
      .select("must_change_password")
      .eq("id", context.userId)
      .maybeSingle();
    return { must_change_password: !!(data as { must_change_password?: boolean } | null)?.must_change_password };
  });

export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ password: z.string().min(6).max(72) }).parse(data))
  .handler(async ({ data, context }) => {
    const { extAdmin, extAnon } = await import("./server");
    // A nova senha não pode ser igual à atual.
    const { error: same } = await extAnon().auth.signInWithPassword({
      email: context.userEmail,
      password: data.password,
    });
    if (!same) throw new Error("A nova senha deve ser diferente da atual.");
    const admin = extAdmin();
    const { error } = await admin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });

// ---------- Editar nome e e-mail ----------
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { data: before } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user_id)
      .maybeSingle();
    const oldName = (before as { full_name?: string | null } | null)?.full_name?.trim();
    const { error } = await admin.auth.admin.updateUserById(data.user_id, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({ id: data.user_id, full_name: data.full_name });
    if (pErr) throw new Error(pErr.message);
    // Mantém o nome do Atendimento em sincronia com o novo nome do usuário.
    if (oldName && oldName !== data.full_name) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("school_id")
        .eq("user_id", data.user_id);
      const schoolIds = [
        ...new Set((roles ?? []).map((r) => r.school_id).filter(Boolean)),
      ] as string[];
      if (schoolIds.length) {
        await admin
          .from("presenters")
          .update({ name: data.full_name })
          .eq("kind", "secretaria")
          .ilike("name", oldName)
          .in("school_id", schoolIds);
      }
    }
    return { ok: true };
  });
