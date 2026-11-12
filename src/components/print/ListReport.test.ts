import { describe, it, expect } from "vitest";
import { enrolledTotal } from "./ListReport";

describe("enrolledTotal", () => {
  it("soma a quantidade de matrículas de cada registro", () => {
    expect(enrolledTotal([{ enrolledCount: 2 }, { enrolledCount: 1 }, { enrolledCount: 0 }])).toBe(3);
  });
  it("registros sem matrícula não somam", () => {
    expect(enrolledTotal([{ enrolledCount: 0 }, { enrolledCount: 0 }])).toBe(0);
  });
  it("lista vazia soma zero", () => {
    expect(enrolledTotal([])).toBe(0);
  });
  it("valor ausente ou inválido conta zero", () => {
    expect(enrolledTotal([{}, { enrolledCount: 5 }])).toBe(5);
  });
});
