// Escolhe o provedor de cada instância. A API oficial da Meta entra aqui (Fase 6)
// implementando a mesma interface WhatsAppProvider.
import type { ProviderKind, WhatsAppProvider } from "./types";

export async function getProvider(kind: ProviderKind): Promise<WhatsAppProvider> {
  if (kind === "evolution") return (await import("./evolution.server")).evolutionProvider;
  throw new Error("A API oficial da Meta ainda não está disponível.");
}

/** Endereço público do portal, usado para montar a URL do webhook. */
export function publicAppUrl(requestOrigin?: string | null): string {
  const fromEnv = process.env["PUBLIC_APP_URL"];
  const base = (fromEnv || requestOrigin || "").replace(/\/+$/, "");
  if (!base) throw new Error("Defina PUBLIC_APP_URL com o endereço público do portal.");
  return base;
}

export function evolutionWebhookUrl(requestOrigin?: string | null): string {
  return `${publicAppUrl(requestOrigin)}/api/public/whatsapp-evolution`;
}

/** Nome técnico da instância na Evolution: minúsculo, sem acento, único. */
export function makeExternalName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `portal-${slug || "instancia"}-${suffix}`;
}

/** Segredo aleatório para o webhook. */
export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
