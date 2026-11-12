import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// Instâncias de WhatsApp (Configurações › WhatsApp). Escrita só pelo admin,
// sempre com a service role; tokens e segredos nunca vão para o navegador.

export type WhatsappInstance = {
  id: string;
  name: string;
  provider: "evolution" | "meta";
  external_name: string;
  school_id: string | null;
  status: "close" | "connecting" | "open";
  phone: string | null;
  profile_name: string | null;
  qr_base64: string | null;
  qr_updated_at: string | null;
  last_event_at: string | null;
  active: boolean;
  created_at: string;
};

const COLS =
  "id, name, provider, external_name, school_id, status, phone, profile_name, qr_base64, qr_updated_at, last_event_at, active, created_at";

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores.");
  return perms;
}

async function requestOrigin(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (proto && host) return `${proto}://${host}`;
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

async function loadInstance(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("whatsapp_instances").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Instância não encontrada.");
  return data as WhatsappInstance;
}

async function log(
  db: SupabaseClient,
  userId: string,
  label: string,
  inst: Pick<WhatsappInstance, "id" | "school_id">,
  data: Record<string, unknown> = {},
) {
  const { data: p } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  await db.from("activity_logs").insert({
    actor_id: userId,
    actor_name: (p?.full_name as string | null) ?? null,
    action: "update",
    table_name: "whatsapp_instances",
    record_id: inst.id,
    school_id: inst.school_id,
    label,
    new_data: data,
  });
}

const idInput = z.object({ id: z.string().uuid() });

export const listWhatsappInstances = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    // RLS: admin vê todas; demais, as da própria unidade.
    const { data, error } = await context.supabase
      .from("whatsapp_instances")
      .select(COLS)
      .order("name");
    if (error) throw new Error(error.message);
    const list = (data ?? []) as WhatsappInstance[];
    return {
      isAdmin: perms.isAdmin,
      configured: Boolean(process.env["EVOLUTION_API_URL"] && process.env["EVOLUTION_API_KEY"]),
      instances: perms.isAdmin ? list : list.map((i) => ({ ...i, qr_base64: null })),
    };
  });

export const createWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ name: z.string().trim().min(2).max(60), school_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider, makeExternalName, randomSecret, evolutionWebhookUrl } = await import(
      "@/lib/whatsapp/provider.server"
    );
    const db = extAdmin();
    const provider = await getProvider("evolution");
    const externalName = makeExternalName(data.name);
    const webhookSecret = randomSecret();
    const webhookUrl = evolutionWebhookUrl(await requestOrigin());

    const { data: created, error } = await db
      .from("whatsapp_instances")
      .insert({
        name: data.name,
        provider: "evolution",
        external_name: externalName,
        school_id: data.school_id,
        status: "connecting",
        created_by: context.userId,
      })
      .select(COLS)
      .single();
    if (error) throw new Error(error.message);
    const inst = created as WhatsappInstance;
    const { error: secErr } = await db
      .from("whatsapp_instance_secrets")
      .insert({ instance_id: inst.id, webhook_secret: webhookSecret });
    if (secErr) {
      await db.from("whatsapp_instances").delete().eq("id", inst.id);
      throw new Error(secErr.message);
    }

    try {
      const res = await provider.createInstance({ externalName, webhookUrl, webhookSecret });
      const now = new Date().toISOString();
      await db.from("whatsapp_instance_secrets").update({ token: res.token, updated_at: now }).eq("instance_id", inst.id);
      if (res.qrBase64) {
        await db
          .from("whatsapp_instances")
          .update({ qr_base64: res.qrBase64, qr_updated_at: now, updated_at: now })
          .eq("id", inst.id);
      }
    } catch (e) {
      // Falhou na Evolution: desfaz no portal para não ficar instância "fantasma".
      await db.from("whatsapp_instances").delete().eq("id", inst.id);
      throw e;
    }
    await log(db, context.userId, `WhatsApp: instância "${data.name}" criada`, inst, { webhook: webhookUrl });
    return loadInstance(db, inst.id);
  });

export const updateWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    idInput
      .extend({
        name: z.string().trim().min(2).max(60),
        school_id: z.string().uuid().nullable(),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const db = extAdmin();
    const { error } = await db
      .from("whatsapp_instances")
      .update({ name: data.name, school_id: data.school_id, active: data.active, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const inst = await loadInstance(db, data.id);
    await log(db, context.userId, `WhatsApp: instância "${data.name}" atualizada`, inst, {
      unidade: data.school_id,
      ativa: data.active,
    });
    return inst;
  });

// Gera um novo QR Code (ou confirma que já está conectada).
export const connectWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    const provider = await getProvider(inst.provider);
    const res = await provider.connect(inst.external_name);
    const now = new Date().toISOString();
    const status = res.base64 ? "connecting" : res.state;
    await db
      .from("whatsapp_instances")
      .update({
        status,
        qr_base64: res.base64,
        qr_updated_at: res.base64 ? now : inst.qr_updated_at,
        updated_at: now,
      })
      .eq("id", inst.id);
    return { ...(await loadInstance(db, inst.id)), pairing_code: res.pairingCode };
  });

// Consulta o estado atual na Evolution (útil se algum webhook se perdeu).
export const refreshWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    const provider = await getProvider(inst.provider);
    const state = await provider.state(inst.external_name);
    await db
      .from("whatsapp_instances")
      .update({
        status: state,
        ...(state === "open" ? { qr_base64: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inst.id);
    return loadInstance(db, inst.id);
  });

// Reaplica a configuração do webhook (ex.: o endereço do portal mudou).
export const resetWhatsappWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider, evolutionWebhookUrl } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    const { data: sec } = await db
      .from("whatsapp_instance_secrets")
      .select("webhook_secret")
      .eq("instance_id", inst.id)
      .single();
    if (!sec?.webhook_secret) throw new Error("Segredo do webhook não encontrado.");
    const provider = await getProvider(inst.provider);
    const webhookUrl = evolutionWebhookUrl(await requestOrigin());
    await provider.setWebhook({ externalName: inst.external_name, webhookUrl, webhookSecret: sec.webhook_secret as string });
    await log(db, context.userId, `WhatsApp: webhook da instância "${inst.name}" reconfigurado`, inst, { webhook: webhookUrl });
    return { ok: true, webhook_url: webhookUrl };
  });

export const logoutWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    const provider = await getProvider(inst.provider);
    await provider.logout(inst.external_name);
    await db
      .from("whatsapp_instances")
      .update({ status: "close", qr_base64: null, updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    await log(db, context.userId, `WhatsApp: instância "${inst.name}" desconectada`, inst);
    return loadInstance(db, inst.id);
  });

// Exclui a instância na Evolution e no portal (conversas e mensagens vão junto).
export const deleteWhatsappInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    const provider = await getProvider(inst.provider);
    try {
      await provider.remove(inst.external_name);
    } catch (e) {
      // Já não existe na Evolution: segue excluindo no portal.
      if (!/\(404\)|not found|não encontrad/i.test(String((e as Error).message))) throw e;
    }
    const { error } = await db.from("whatsapp_instances").delete().eq("id", inst.id);
    if (error) throw new Error(error.message);
    await log(db, context.userId, `WhatsApp: instância "${inst.name}" excluída`, inst);
    return { ok: true };
  });

// Envia uma mensagem de teste. A cópia no histórico chega pelo webhook (SEND_MESSAGE).
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    idInput
      .extend({
        phone: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
        text: z.string().trim().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const { getProvider } = await import("@/lib/whatsapp/provider.server");
    const db = extAdmin();
    const inst = await loadInstance(db, data.id);
    if (inst.status !== "open") throw new Error("A instância não está conectada.");
    // Número brasileiro sem DDI: acrescenta 55.
    const phone = data.phone.length <= 11 ? `55${data.phone}` : data.phone;
    const provider = await getProvider(inst.provider);
    const sent = await provider.sendText({ externalName: inst.external_name, phone, text: data.text });
    await log(db, context.userId, `WhatsApp: mensagem de teste enviada pela instância "${inst.name}"`, inst, { para: phone });
    return { ok: true, external_id: sent.externalId };
  });
