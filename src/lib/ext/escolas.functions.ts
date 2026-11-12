import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export const listSchools = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("schools").select("*").order("name");
    if (error) throw new Error(error.message);
    return data;
  });

const schoolInput = z.object({
  name: z.string().min(2),
  logo_url: z.string().optional().nullable(),
  id_prefix: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Use apenas letras e números"),
  id_digits: z.number().int().min(2).max(8),
  id_next_number: z.number().int().min(1),
});

export const createSchool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => schoolInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: created, error } = await context.supabase
      .from("schools")
      .insert({
        name: data.name,
        logo_url: data.logo_url || null,
        id_prefix: data.id_prefix.toUpperCase(),
        id_digits: data.id_digits,
        id_next_number: data.id_next_number,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateSchool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).merge(schoolInput).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("schools")
      .update({
        name: data.name,
        logo_url: data.logo_url || null,
        id_prefix: data.id_prefix.toUpperCase(),
        id_digits: data.id_digits,
        id_next_number: data.id_next_number,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
