// Tradução dos webhooks da Evolution API v2 para eventos do portal.
// Função pura (sem rede, sem banco) para poder ser testada isoladamente.
import type { ConnectionState, MessageType, NormalizedEvent } from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** "MESSAGES_UPSERT" e "messages.upsert" viram "messages.upsert". */
export function normalizeEventName(name: unknown): string {
  return String(name ?? "").trim().toLowerCase().replace(/_/g, ".");
}

/** Só dígitos; tira o sufixo do JID (5583...@s.whatsapp.net, 5583...:12@...). */
export function phoneFromJid(jid: string | null | undefined): string {
  const user = String(jid ?? "").split("@")[0] ?? "";
  return (user.split(":")[0] ?? "").replace(/\D/g, "");
}

/** Conversas que o portal ignora: grupos, status, canais e listas de transmissão. */
export function isIgnoredJid(jid: string): boolean {
  return /@g\.us$|@broadcast$|@newsletter$|^status@/i.test(jid);
}

export function mapConnectionState(v: unknown): ConnectionState {
  const s = String(v ?? "").toLowerCase();
  if (s === "open") return "open";
  if (s === "connecting") return "connecting";
  return "close";
}

const STATUS_MAP: Record<string, "pending" | "sent" | "delivered" | "read" | "failed"> = {
  error: "failed",
  pending: "pending",
  server_ack: "sent",
  delivery_ack: "delivered",
  read: "read",
  played: "read",
};

function toIso(ts: unknown): string {
  const n = typeof ts === "string" ? Number(ts) : typeof ts === "number" ? ts : NaN;
  if (Number.isFinite(n) && n > 0) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  return new Date().toISOString();
}

/** Conteúdo da mensagem: tipo, texto (ou legenda) e mimetype. */
export function extractContent(message: unknown): { type: MessageType; body: string | null; mime: string | null } {
  if (!isObj(message)) return { type: "other", body: null, mime: null };
  // Mensagens "embrulhadas" (temporárias, visualização única, editadas).
  for (const wrap of ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "documentWithCaptionMessage", "editedMessage"]) {
    const inner = message[wrap];
    if (isObj(inner) && isObj(inner["message"])) return extractContent(inner["message"]);
  }
  const conv = str(message["conversation"]);
  if (conv) return { type: "text", body: conv, mime: null };
  const ext = message["extendedTextMessage"];
  if (isObj(ext)) return { type: "text", body: str(ext["text"]), mime: null };

  const media: [string, MessageType][] = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"],
    ["stickerMessage", "sticker"],
  ];
  for (const [key, type] of media) {
    const m = message[key];
    if (isObj(m)) {
      const body = str(m["caption"]) ?? (type === "document" ? str(m["fileName"]) : null);
      return { type, body, mime: str(m["mimetype"]) };
    }
  }
  const loc = message["locationMessage"];
  if (isObj(loc)) {
    const lat = loc["degreesLatitude"];
    const lng = loc["degreesLongitude"];
    return { type: "location", body: lat != null && lng != null ? `${lat},${lng}` : null, mime: null };
  }
  const contact = message["contactMessage"];
  if (isObj(contact)) return { type: "contact", body: str(contact["displayName"]), mime: null };
  return { type: "other", body: null, mime: null };
}

function parseMessage(instance: string, d: Obj): NormalizedEvent | null {
  const key = isObj(d["key"]) ? d["key"] : null;
  if (!key) return null;
  // Em contas com LID, o número real pode vir em remoteJidAlt / senderPn.
  const jidRaw = str(key["remoteJid"]) ?? "";
  const alt = str(key["remoteJidAlt"]) ?? str(key["senderPn"]);
  const remoteJid = /@lid$/i.test(jidRaw) && alt ? alt : jidRaw;
  const externalId = str(key["id"]);
  if (!remoteJid || !externalId || isIgnoredJid(remoteJid)) return null;
  const phone = phoneFromJid(remoteJid);
  if (!phone) return null;
  // Mensagens de protocolo (apagar, reação, etc.) não viram mensagem no chat.
  const message = d["message"];
  if (isObj(message) && (message["protocolMessage"] || message["reactionMessage"])) return null;
  const content = extractContent(message);
  return {
    kind: "message",
    instance,
    externalId,
    remoteJid,
    phone,
    fromMe: key["fromMe"] === true,
    pushName: str(d["pushName"]),
    type: content.type,
    body: content.body,
    mime: content.mime,
    sentAt: toIso(d["messageTimestamp"]),
    raw: d,
  };
}

/** Lê o corpo do webhook (um evento, com `data` objeto ou lista). */
export function parseEvolutionWebhook(payload: unknown): NormalizedEvent[] {
  if (!isObj(payload)) return [];
  const event = normalizeEventName(payload["event"]);
  const instance = str(payload["instance"]);
  if (!instance) return [];
  const data = payload["data"];
  const items: Obj[] = Array.isArray(data) ? data.filter(isObj) : isObj(data) ? [data] : [];
  const out: NormalizedEvent[] = [];

  if (event === "connection.update") {
    for (const d of items) {
      out.push({
        kind: "connection",
        instance,
        state: mapConnectionState(d["state"]),
        phone: phoneFromJid(str(d["wuid"])) || null,
        profileName: str(d["profileName"]),
      });
    }
  } else if (event === "qrcode.updated") {
    for (const d of items) {
      const qr = isObj(d["qrcode"]) ? d["qrcode"] : d;
      const base64 = str(qr["base64"]);
      if (base64) out.push({ kind: "qrcode", instance, base64 });
    }
  } else if (event === "messages.upsert" || event === "send.message") {
    // send.message = mensagem enviada pela própria API; chega como fromMe.
    const list = items.flatMap((d) => (Array.isArray(d["messages"]) ? (d["messages"] as unknown[]).filter(isObj) : [d]));
    for (const d of list) {
      const m = parseMessage(instance, d);
      if (m) out.push(m);
    }
  } else if (event === "messages.update") {
    for (const d of items) {
      const id = str(d["keyId"]) ?? (isObj(d["key"]) ? str(d["key"]["id"]) : null);
      const raw = String(d["status"] ?? (isObj(d["update"]) ? d["update"]["status"] : "") ?? "").toLowerCase();
      const status = STATUS_MAP[raw];
      if (id && status) out.push({ kind: "message_status", instance, externalId: id, status });
    }
  }
  return out;
}
