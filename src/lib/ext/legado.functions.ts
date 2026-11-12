import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

export type LegacyDataset = {
  id: string;
  name: string;
  school_year: number;
  source_filename: string | null;
  columns: string[];
  row_count: number;
  created_at: string;
};

// Toda a área "Bancos anteriores" é exclusiva do Administrador.
async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
}

export const listLegacyDatasets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("legacy_datasets")
      .select("id, name, school_year, source_filename, columns, row_count, created_at")
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as LegacyDataset[];
  });

export const createLegacyDataset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(2),
        school_year: z.number().int().min(1990).max(2100),
        source_filename: z.string().optional().nullable(),
        columns: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: created, error } = await context.supabase
      .from("legacy_datasets")
      .insert({
        name: data.name.trim(),
        school_year: data.school_year,
        source_filename: data.source_filename || null,
        columns: data.columns,
        row_count: 0,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um banco com esse nome nesse ano.");
      throw new Error(error.message);
    }
    return { id: created.id as string };
  });

export const appendLegacyRows = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        dataset_id: z.string().uuid(),
        start_index: z.number().int().min(0),
        rows: z
          .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const payload = data.rows.map((row, i) => ({
      dataset_id: data.dataset_id,
      row_index: data.start_index + i,
      data: row,
    }));
    const { error } = await context.supabase.from("legacy_rows").insert(payload);
    if (error) throw new Error(error.message);
    return { inserted: payload.length };
  });

export const finalizeLegacyDataset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ dataset_id: z.string().uuid(), row_count: z.number().int().min(0) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("legacy_datasets")
      .update({ row_count: data.row_count })
      .eq("id", data.dataset_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLegacyDataset = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("legacy_datasets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLegacyRows = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        dataset_id: z.string().uuid(),
        page: z.number().int().min(0).default(0),
        search: z.string().optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const pageSize = 50;
    let query = context.supabase
      .from("legacy_rows")
      .select("row_index, data", { count: "exact" })
      .eq("dataset_id", data.dataset_id);
    const term = data.search.trim();
    if (term) query = query.ilike("data::text", `%${term}%`);
    const {
      data: rows,
      error,
      count,
    } = await query
      .order("row_index")
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []) as {
        row_index: number;
        data: Record<string, string | number | boolean | null>;
      }[],
      total: count ?? 0,
      pageSize,
    };
  });

// ---------- Indicadores de anos anteriores (tela Início) ----------

const SCHOOL_COLUMN = "ESCOLA";
const CHILDREN_COLUMN = "Quantos alunos pretende trazer para estudar conosco?";
const DATE_COLUMN = "Carimbo de data/hora";

export type LegacyYearStats = {
  year: number;
  visits: number;
  children: number;
  bySchool: { name: string; visits: number; children: number }[];
  monthly: { month: number; visits: number; children: number }[];
  daily: { month: number; day: number; visits: number; children: number }[];
};

// "dd/mm/aaaa hh:mm:ss" -> posição no ano letivo (0 = agosto ... 11 = julho) + dia
function schoolDate(raw: unknown): { month: number; day: number } | null {
  const text = String(raw ?? "").trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return { month: (month - 8 + 12) % 12, day };
}

export const getLegacyYearStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        years: z.array(z.number().int().min(1990).max(2100)).max(10),
        schoolNames: z.array(z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.years.length === 0) return [] as LegacyYearStats[];

    const { data: datasets, error } = await context.supabase
      .from("legacy_datasets")
      .select("id, school_year")
      .in("school_year", data.years);
    if (error) throw new Error(error.message);
    if (!datasets || datasets.length === 0) return [] as LegacyYearStats[];

    const filter = (data.schoolNames ?? [])
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n.length > 0);

    const byYear = new Map<number, LegacyYearStats>();
    for (const year of data.years) {
      byYear.set(year, {
        year,
        visits: 0,
        children: 0,
        bySchool: [],
        monthly: Array.from({ length: 12 }, (_, month) => ({ month, visits: 0, children: 0 })),
        daily: [],
      });
    }
    const schoolsByYear = new Map<number, Map<string, { visits: number; children: number }>>();
    const dailyByYear = new Map<number, Map<string, { month: number; day: number; visits: number; children: number }>>();

    const pageSize = 1000;
    for (const dataset of datasets) {
      const year = dataset.school_year as number;
      const stats = byYear.get(year);
      if (!stats) continue;
      const schoolMap = schoolsByYear.get(year) ?? new Map();
      schoolsByYear.set(year, schoolMap);
      const dailyMap = dailyByYear.get(year) ?? new Map();
      dailyByYear.set(year, dailyMap);

      for (let page = 0; ; page++) {
        const { data: rows, error: rowsError } = await context.supabase
          .from("legacy_rows")
          .select("data")
          .eq("dataset_id", dataset.id as string)
          .order("row_index")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (rowsError) throw new Error(rowsError.message);
        const list = (rows ?? []) as { data: Record<string, unknown> }[];
        for (const row of list) {
          const raw = row.data ?? {};
          const schoolName = String(raw[SCHOOL_COLUMN] ?? "").trim() || "—";
          if (filter.length > 0 && !filter.includes(schoolName.toLowerCase())) continue;
          const parsed = Number(String(raw[CHILDREN_COLUMN] ?? "").replace(/[^0-9]/g, ""));
          const childCount = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
          stats.visits += 1;
          stats.children += childCount;
          const entry = schoolMap.get(schoolName) ?? { visits: 0, children: 0 };
          entry.visits += 1;
          entry.children += childCount;
          schoolMap.set(schoolName, entry);
          const date = schoolDate(raw[DATE_COLUMN]);
          if (date) {
            const bucket = stats.monthly[date.month];
            if (bucket) {
              bucket.visits += 1;
              bucket.children += childCount;
            }
            const key = `${date.month}-${date.day}`;
            const dailyEntry = dailyMap.get(key) ?? { month: date.month, day: date.day, visits: 0, children: 0 };
            dailyEntry.visits += 1;
            dailyEntry.children += childCount;
            dailyMap.set(key, dailyEntry);
          }
        }
        if (list.length < pageSize) break;
      }
    }

    const result: LegacyYearStats[] = [];
    for (const stats of byYear.values()) {
      const schoolMap = schoolsByYear.get(stats.year);
      if (!schoolMap) continue;
      stats.bySchool = [...schoolMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "pt-BR"));
      stats.daily = [...(dailyByYear.get(stats.year)?.values() ?? [])].sort(
        (a, b) => a.month - b.month || a.day - b.day,
      );
      result.push(stats);
    }
    return result;
  });
