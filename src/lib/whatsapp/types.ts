// Tipos comuns a todos os provedores de WhatsApp (Evolution API hoje, Meta depois).
// O restante do portal só conversa com estes tipos — nunca com a API do provedor.

export type ProviderKind = "evolution" | "meta";

export type ConnectionState = "close" | "connecting" | "open";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "other";

/** Evento já traduzido para o formato do portal. */
export type NormalizedEvent =
  | {
      kind: "connection";
      instance: string; // external_name
      state: ConnectionState;
      phone?: string | null;
      profileName?: string | null;
    }
  | { kind: "qrcode"; instance: string; base64: string }
  | {
      kind: "message";
      instance: string;
      externalId: string;
      remoteJid: string;
      phone: string; // só dígitos, com DDI
      fromMe: boolean;
      pushName: string | null;
      type: MessageType;
      body: string | null;
      mime: string | null;
      sentAt: string; // ISO
      raw: unknown;
    }
  | {
      kind: "message_status";
      instance: string;
      externalId: string;
      status: "pending" | "sent" | "delivered" | "read" | "failed";
    };

export type CreatedInstance = {
  token: string | null;
  qrBase64: string | null;
};

export type QrResult = {
  base64: string | null;
  pairingCode: string | null;
  state: ConnectionState;
};

export type SentMessage = { externalId: string };

/** O que cada provedor precisa saber fazer. */
export interface WhatsAppProvider {
  readonly kind: ProviderKind;
  createInstance(opts: {
    externalName: string;
    webhookUrl: string;
    webhookSecret: string;
  }): Promise<CreatedInstance>;
  /** Reconfigura o webhook (ex.: mudou o endereço do portal). */
  setWebhook(opts: { externalName: string; webhookUrl: string; webhookSecret: string }): Promise<void>;
  connect(externalName: string): Promise<QrResult>;
  state(externalName: string): Promise<ConnectionState>;
  logout(externalName: string): Promise<void>;
  remove(externalName: string): Promise<void>;
  sendText(opts: { externalName: string; phone: string; text: string }): Promise<SentMessage>;
  /** Lê o corpo do webhook e devolve os eventos que interessam ao portal. */
  parseWebhook(payload: unknown): NormalizedEvent[];
}
