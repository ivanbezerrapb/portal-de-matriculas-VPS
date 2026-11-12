// Grava no banco os eventos recebidos pelo webhook (somente servidor, service role).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageType, NormalizedEvent } from "./types";

const PREVIEW: Record<MessageType, string> = {
  text: "",
  image: "📷 Imagem",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  document: "📄 Documento",
  sticker: "Figurinha",
  location: "📍 Localização",
  contact: "👤 Contato",
  other: "Mensagem",
};

export function messagePreview(type: MessageType, body: string | null): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  const label = PREVIEW[type];
  const out = type === "text" ? text : text ? `${label}: ${text}` : label;
  return out.slice(0, 140);
}

const STATUS_RANK: Record<string, number> = { failed: 0, pending: 1, sent: 2, delivered: 3, read: 4 };

export async function ingestEvents(
  db: SupabaseClient,
  instanceId: string,
  events: NormalizedEvent[],
): Promise<{ applied: number }> {
  let applied = 0;
  const now = new Date().toISOString();
  for (const ev of events) {
    if (ev.kind === "connection") {
      const patch: Record<string, unknown> = { status: ev.state, last_event_at: now, updated_at: now };
      if (ev.state === "open") {
        patch["qr_base64"] = null;
        if (ev.phone) patch["phone"] = ev.phone;
        if (ev.profileName) patch["profile_name"] = ev.profileName;
      }
      await db.from("whatsapp_instances").update(patch).eq("id", instanceId);
      applied++;
    } else if (ev.kind === "qrcode") {
      await db
        .from("whatsapp_instances")
        .update({ qr_base64: ev.base64, qr_updated_at: now, status: "connecting", last_event_at: now, updated_at: now })
        .eq("id", instanceId);
      applied++;
    } else if (ev.kind === "message") {
      if (await ingestMessage(db, instanceId, ev)) applied++;
    } else if (ev.kind === "message_status") {
      const { data: cur } = await db
        .from("wa_messages")
        .select("id, status")
        .eq("instance_id", instanceId)
        .eq("external_id", ev.externalId)
        .maybeSingle();
      if (!cur) continue;
      const oldRank = STATUS_RANK[(cur.status as string | null) ?? ""] ?? -1;
      // Não volta o status (ex.: "lida" não vira "entregue"), exceto falha.
      if (ev.status !== "failed" && STATUS_RANK[ev.status]! <= oldRank) continue;
      await db.from("wa_messages").update({ status: ev.status }).eq("id", cur.id);
      applied++;
    }
  }
  await db.from("whatsapp_instances").update({ last_event_at: now }).eq("id", instanceId);
  return { applied };
}

async function ingestMessage(
  db: SupabaseClient,
  instanceId: string,
  ev: Extract<NormalizedEvent, { kind: "message" }>,
): Promise<boolean> {
  const now = new Date().toISOString();

  // Contato (por telefone). Mensagem enviada por nós não traz o nome do contato.
  if (ev.fromMe || !ev.pushName) {
    await db.from("wa_contacts").upsert({ phone: ev.phone }, { onConflict: "phone", ignoreDuplicates: true });
  } else {
    await db
      .from("wa_contacts")
      .upsert({ phone: ev.phone, push_name: ev.pushName, updated_at: now }, { onConflict: "phone" });
  }
  const { data: contact, error: cErr } = await db.from("wa_contacts").select("id").eq("phone", ev.phone).single();
  if (cErr || !contact) throw new Error(`Contato: ${cErr?.message ?? "não encontrado"}`);

  // Conversa (uma por instância + contato).
  await db
    .from("wa_conversations")
    .upsert(
      { instance_id: instanceId, contact_id: contact.id, remote_jid: ev.remoteJid },
      { onConflict: "instance_id,remote_jid", ignoreDuplicates: true },
    );
  const { data: conv, error: convErr } = await db
    .from("wa_conversations")
    .select("id, status, unread_count, last_message_at")
    .eq("instance_id", instanceId)
    .eq("remote_jid", ev.remoteJid)
    .single();
  if (convErr || !conv) throw new Error(`Conversa: ${convErr?.message ?? "não encontrada"}`);

  // Mensagem: o WhatsApp pode reenviar o mesmo evento; o índice único evita duplicar.
  const { data: inserted, error: mErr } = await db
    .from("wa_messages")
    .upsert(
      {
        conversation_id: conv.id,
        instance_id: instanceId,
        external_id: ev.externalId,
        direction: ev.fromMe ? "out" : "in",
        type: ev.type,
        body: ev.body,
        media_mime: ev.mime,
        status: ev.fromMe ? "sent" : null,
        sent_at: ev.sentAt,
        raw: ev.raw as object,
      },
      { onConflict: "instance_id,external_id", ignoreDuplicates: true },
    )
    .select("id");
  if (mErr) throw new Error(`Mensagem: ${mErr.message}`);
  if (!inserted?.length) return false; // já existia

  // Atualiza o resumo da conversa só se a mensagem for a mais recente.
  const isLatest =
    !conv.last_message_at || Date.parse(ev.sentAt) >= Date.parse(conv.last_message_at as string);
  const patch: Record<string, unknown> = { updated_at: now };
  if (isLatest) {
    patch["last_message_at"] = ev.sentAt;
    patch["last_message_preview"] = messagePreview(ev.type, ev.body);
  }
  if (!ev.fromMe) {
    patch["unread_count"] = ((conv.unread_count as number | null) ?? 0) + 1;
    // Conversa encerrada volta para a fila quando o contato escreve de novo.
    if (conv.status === "closed") patch["status"] = "pending";
  }
  await db.from("wa_conversations").update(patch).eq("id", conv.id);
  return true;
}
