// Provedor Evolution API v2 (somente servidor).
// Variáveis de ambiente:
//   EVOLUTION_API_URL  — ex.: https://evolution.seudominio.com.br
//   EVOLUTION_API_KEY  — chave global (AUTHENTICATION_API_KEY da Evolution)
import { mapConnectionState, parseEvolutionWebhook } from "./evolution-events";
import type { ConnectionState, CreatedInstance, QrResult, SentMessage, WhatsAppProvider } from "./types";

// Eventos que o portal precisa receber.
export const EVOLUTION_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
] as const;

// Cabeçalho com o segredo do webhook, conferido em /api/public/whatsapp-evolution.
export const WEBHOOK_SECRET_HEADER = "x-portal-webhook-secret";

type Obj = Record<string, unknown>;

function config() {
  const url = process.env["EVOLUTION_API_URL"];
  const key = process.env["EVOLUTION_API_KEY"];
  if (!url || !key) throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).");
  return { url: url.replace(/\/+$/, ""), key };
}

async function call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<Obj> {
  const { url, key } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method,
      headers: { "Content-Type": "application/json", apikey: key },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Não foi possível falar com o servidor da Evolution API.");
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }
  if (!res.ok) {
    const o = (json ?? {}) as Obj;
    const resp = o["response"] as Obj | undefined;
    const msg = resp?.["message"] ?? o["message"] ?? o["error"] ?? text.slice(0, 200);
    throw new Error(`Evolution API (${res.status}): ${Array.isArray(msg) ? msg.join("; ") : String(msg)}`);
  }
  return (json ?? {}) as Obj;
}

const enc = encodeURIComponent;

function webhookConfig(webhookUrl: string, webhookSecret: string) {
  const url = new URL(webhookUrl);
  url.searchParams.set("s", webhookSecret);
  return {
    enabled: true,
    url: url.toString(),
    byEvents: false,
    base64: false,
    headers: { [WEBHOOK_SECRET_HEADER]: webhookSecret },
    events: [...EVOLUTION_EVENTS],
  };
}

export const evolutionProvider: WhatsAppProvider = {
  kind: "evolution",

  async createInstance({ externalName, webhookUrl, webhookSecret }): Promise<CreatedInstance> {
    const json = await call("POST", "/instance/create", {
      instanceName: externalName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: true,
      rejectCall: false,
      alwaysOnline: false,
      readMessages: false,
      syncFullHistory: false,
      webhook: webhookConfig(webhookUrl, webhookSecret),
    });
    const hash = json["hash"];
    const token = typeof hash === "string" ? hash : (hash as Obj | undefined)?.["apikey"];
    const qr = json["qrcode"] as Obj | undefined;
    return {
      token: typeof token === "string" ? token : null,
      qrBase64: typeof qr?.["base64"] === "string" ? (qr["base64"] as string) : null,
    };
  },

  async setWebhook({ externalName, webhookUrl, webhookSecret }) {
    await call("POST", `/webhook/set/${enc(externalName)}`, { webhook: webhookConfig(webhookUrl, webhookSecret) });
  },

  async connect(externalName): Promise<QrResult> {
    const json = await call("GET", `/instance/connect/${enc(externalName)}`);
    const inst = json["instance"] as Obj | undefined;
    const base64 = typeof json["base64"] === "string" ? (json["base64"] as string) : null;
    return {
      base64,
      pairingCode: typeof json["pairingCode"] === "string" ? (json["pairingCode"] as string) : null,
      // Sem QR e com estado "open" = já conectado.
      state: inst?.["state"] ? mapConnectionState(inst["state"]) : base64 ? "connecting" : "close",
    };
  },

  async state(externalName): Promise<ConnectionState> {
    const json = await call("GET", `/instance/connectionState/${enc(externalName)}`);
    const inst = json["instance"] as Obj | undefined;
    return mapConnectionState(inst?.["state"] ?? json["state"]);
  },

  async logout(externalName) {
    await call("DELETE", `/instance/logout/${enc(externalName)}`);
  },

  async remove(externalName) {
    await call("DELETE", `/instance/delete/${enc(externalName)}`);
  },

  async sendText({ externalName, phone, text }): Promise<SentMessage> {
    const json = await call("POST", `/message/sendText/${enc(externalName)}`, { number: phone, text });
    const key = json["key"] as Obj | undefined;
    const id = key?.["id"];
    if (typeof id !== "string") throw new Error("A Evolution API não devolveu o id da mensagem.");
    return { externalId: id };
  },

  parseWebhook: parseEvolutionWebhook,
};
