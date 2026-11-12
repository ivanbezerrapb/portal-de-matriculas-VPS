import { describe, expect, it } from "vitest";
import { nameWithCode } from "./maxbot.server";

describe("nameWithCode", () => {
  it("remove o código do início do nome do card", () => {
    expect(nameWithCode("0019/EX2027 · Rosa Maria", "0019/EX2027")).toBe("Rosa Maria (0019/EX2027)");
  });
  it("corrige nome já errado no Maxbot", () => {
    expect(nameWithCode("0021/EX2027 · LUCCAS COELHO UCHOA (0021/EX2027)", "0021/EX2027")).toBe("LUCCAS COELHO UCHOA (0021/EX2027)");
  });
  it("mantém nome simples", () => {
    expect(nameWithCode("Ivanildo Farias", "1050/CE2027")).toBe("Ivanildo Farias (1050/CE2027)");
  });
});

import { cleanName } from "./maxbot.server";
describe("cleanName", () => {
  it("card só com código fica vazio (usa nome da ficha)", () => {
    expect(cleanName("1050/CE2027")).toBe("");
  });
});
