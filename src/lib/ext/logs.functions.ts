import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
}

function userAgent() {
  return (getRequest()?.headers.get("user-agent") ?? "").slice(0, 300);
}

// Registra login, abertura de sessão (no máx. 1 a cada 30 min) e logout.
export const recordAccess = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ event: z.enum(["login", "session", "logout"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    if (data.event === "session") {
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: recent } = await admin
        .from("access_logs")
        .select("id")
        .eq("user_id", context.userId)
        .in("event", ["login", "session"])
        .gte("created_at", since)
        .limit(1);
      if (recent && recent.length > 0) return { ok: true };
    }
    await admin.from("access_logs").insert({
      user_id: context.userId,
      email: context.userEmail,
      event: data.event,
      user_agent: userAgent(),
    });
    return { ok: true };
  });

// Tentativa de login sem sucesso (sem sessão; grava só o e-mail digitado).
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { extAdmin } = await import("./server");
    await extAdmin().from("access_logs").insert({
      user_id: null,
      email: data.email.toLowerCase(),
      event: "failed",
      user_agent: userAgent(),
    });
    return { ok: true };
  });

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  schools: string[];
  last_access: string | null;
  count30: number;
};

export const getAccessSummary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [{ data: users }, { data: profiles }, { data: roles }, { data: schools }, { data: logs }] =
      await Promise.all([
        admin.auth.admin.listUsers({ perPage: 1000 }),
        admin.from("profiles").select("id, full_name"),
        admin.from("user_roles").select("user_id, role, school_id"),
        admin.from("schools").select("id, name"),
        admin
          .from("access_logs")
          .select("user_id, created_at")
          .in("event", ["login", "session"])
          .gte("created_at", since)
          .limit(20000),
      ]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]));
    const schoolOf = new Map((schools ?? []).map((s) => [s.id as string, s.name as string]));
    const lastLog = new Map<string, string>();
    const count = new Map<string, number>();
    for (const l of logs ?? []) {
      const u = l.user_id as string;
      count.set(u, (count.get(u) ?? 0) + 1);
      if (!lastLog.has(u) || (lastLog.get(u) as string) < (l.created_at as string))
        lastLog.set(u, l.created_at as string);
    }
    const out: AccessUser[] = (users?.users ?? []).map((u) => {
      const r = (roles ?? []).filter((x) => x.user_id === u.id);
      const candidates = [u.last_sign_in_at, lastLog.get(u.id)].filter(Boolean) as string[];
      return {
        id: u.id,
        name: nameOf.get(u.id) || u.email || "",
        email: u.email ?? "",
        roles: [...new Set(r.map((x) => x.role as string))],
        schools: [
          ...new Set(r.map((x) => (x.school_id ? schoolOf.get(x.school_id as string) : null)).filter(Boolean)),
        ] as string[],
        last_access: candidates.sort().at(-1) ?? null,
        count30: count.get(u.id) ?? 0,
      };
    });
    return out.sort((a, b) => (b.last_access ?? "").localeCompare(a.last_access ?? ""));
  });

export type AccessEvent = {
  id: number;
  user_id: string | null;
  email: string | null;
  event: string;
  user_agent: string | null;
  created_at: string;
};

export const listAccessEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().int().min(0),
        event: z.string().optional(),
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    let q = context.supabase
      .from("access_logs")
      .select("id, user_id, email, event, user_agent, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * 50, data.page * 50 + 49);
    if (data.event) q = q.eq("event", data.event);
    if (data.search) q = q.ilike("email", `%${data.search}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as AccessEvent[], total: count ?? 0 };
  });

export type ActivityRow = {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  school_id: string | null;
  label: string | null;
  old_data: Record<string, string | number | boolean | null> | null;
  new_data: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().int().min(0),
        table: z.string().optional(),
        action: z.string().optional(),
        actor: z.string().optional(),
        school: z.string().optional(),
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    let q = context.supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * 50, data.page * 50 + 49);
    if (data.table) q = q.eq("table_name", data.table);
    if (data.action) q = q.eq("action", data.action);
    if (data.actor === "system") q = q.is("actor_id", null);
    else if (data.actor) q = q.eq("actor_id", data.actor);
    if (data.school) q = q.eq("school_id", data.school);
    if (data.search) q = q.or(`label.ilike.%${data.search.replace(/[,()]/g, " ")}%,actor_name.ilike.%${data.search.replace(/[,()]/g, " ")}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as ActivityRow[], total: count ?? 0 };
  });

export const listLogFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const [{ data: profiles }, { data: schools }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name").order("full_name"),
      context.supabase.from("schools").select("id, name").order("name"),
    ]);
    return {
      users: (profiles ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || "—" })),
      schools: (schools ?? []).map((s) => ({ id: s.id as string, name: s.name as string })),
    };
  });
