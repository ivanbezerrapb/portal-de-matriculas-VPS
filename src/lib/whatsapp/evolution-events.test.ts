import { describe, it, expect } from "vitest";
import { extractContent, parseEvolutionWebhook, phoneFromJid } from "./evolution-events";

describe("phoneFromJid", () => {
  it("tira o sufixo", () => expect(phoneFromJid("5583999990000@s.whatsapp.net")).toBe("5583999990000"));
  it("tira o dispositivo", () => expect(phoneFromJid("5583999990000:12@s.whatsapp.net")).toBe("5583999990000"));
  it("vazio", () => expect(phoneFromJid(null)).toBe(""));
});

describe("extractContent", () => {
  it("texto simples", () => expect(extractContent({ conversation: "Oi" })).toEqual({ type: "text", body: "Oi", mime: null }));
  it("texto estendido", () =>
    expect(extractContent({ extendedTextMessage: { text: "Olá" } })).toEqual({ type: "text", body: "Olá", mime: null }));
  it("imagem com legenda", () =>
    expect(extractContent({ imageMessage: { caption: "foto", mimetype: "image/jpeg" } })).toEqual({
      type: "image", body: "foto", mime: "image/jpeg",
    }));
  it("áudio", () =>
    expect(extractContent({ audioMessage: { mimetype: "audio/ogg; codecs=opus" } }).type).toBe("audio"));
  it("mensagem temporária", () =>
    expect(extractContent({ ephemeralMessage: { message: { conversation: "x" } } }).body).toBe("x"));
});

describe("parseEvolutionWebhook", () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    event: "messages.upsert",
    instance: "centro",
    data: {
      key: { remoteJid: "5583999990000@s.whatsapp.net", fromMe: false, id: "ABC" },
      pushName: "Maria",
      message: { conversation: "Quero visitar a escola" },
      messageType: "conversation",
      messageTimestamp: 1731420000,
      ...over,
    },
  });

  it("mensagem recebida", () => {
    const [e] = parseEvolutionWebhook(msg());
    expect(e).toMatchObject({
      kind: "message", instance: "centro", externalId: "ABC", phone: "5583999990000",
      fromMe: false, pushName: "Maria", type: "text", body: "Quero visitar a escola",
      sentAt: "2024-11-12T14:00:00.000Z",
    });
  });

  it("aceita o nome do evento em maiúsculas", () => {
    expect(parseEvolutionWebhook({ ...msg(), event: "MESSAGES_UPSERT" })).toHaveLength(1);
  });

  it("ignora grupos e status", () => {
    expect(parseEvolutionWebhook(msg({ key: { remoteJid: "123@g.us", id: "1" } }))).toEqual([]);
    expect(parseEvolutionWebhook(msg({ key: { remoteJid: "status@broadcast", id: "2" } }))).toEqual([]);
  });

  it("usa o número alternativo quando o JID é LID", () => {
    const [e] = parseEvolutionWebhook(
      msg({ key: { remoteJid: "999@lid", remoteJidAlt: "5583988887777@s.whatsapp.net", id: "L1" } }),
    );
    expect(e).toMatchObject({ phone: "5583988887777" });
  });

  it("ignora reações", () => {
    expect(parseEvolutionWebhook(msg({ message: { reactionMessage: { text: "👍" } } }))).toEqual([]);
  });

  it("conexão", () => {
    expect(
      parseEvolutionWebhook({
        event: "connection.update", instance: "centro",
        data: { state: "open", wuid: "5583999990000@s.whatsapp.net", profileName: "Escola" },
      }),
    ).toEqual([{ kind: "connection", instance: "centro", state: "open", phone: "5583999990000", profileName: "Escola" }]);
  });

  it("QR Code", () => {
    expect(
      parseEvolutionWebhook({ event: "qrcode.updated", instance: "centro", data: { qrcode: { base64: "data:image/png;base64,AA" } } }),
    ).toEqual([{ kind: "qrcode", instance: "centro", base64: "data:image/png;base64,AA" }]);
  });

  it("status da mensagem", () => {
    expect(
      parseEvolutionWebhook({ event: "messages.update", instance: "centro", data: { keyId: "ABC", status: "READ" } }),
    ).toEqual([{ kind: "message_status", instance: "centro", externalId: "ABC", status: "read" }]);
  });

  it("corpo inválido", () => {
    expect(parseEvolutionWebhook(null)).toEqual([]);
    expect(parseEvolutionWebhook({ event: "messages.upsert" })).toEqual([]);
  });
});
