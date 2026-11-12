import { describe, expect, it } from "vitest";
import { countOverdue, totalsByAttendant, totalsBySchool, totalsBySeries } from "./relatorios-logic";

describe("relatórios", () => {
  it("soma matrículas por unidade na ordem padrão", () => {
    expect(totalsBySchool([
      { school: "Bessa", series: [], count: 2 },
      { school: "Centro", series: [], count: 1 },
      { school: "Centro", series: [], count: 3 },
    ])).toEqual([{ label: "Centro", total: 4 }, { label: "Bessa", total: 2 }]);
  });
  it("soma por série", () => {
    expect(totalsBySeries([
      { school: "Centro", series: ["1º Ano", "3º Ano"], count: 2 },
      { school: "Centro", series: ["1º Ano"], count: 1 },
    ])).toEqual([{ label: "1º Ano", total: 2 }, { label: "3º Ano", total: 1 }]);
  });
  it("tarefa atrasada = aberta e vencida antes de hoje", () => {
    expect(countOverdue([
      { done: false, due_date: "2026-11-10" },
      { done: true, due_date: "2026-11-01" },
      { done: false, due_date: "2026-11-12" },
      { done: false, due_date: null },
    ], "2026-11-12")).toBe(1);
  });
  it("totais por atendente", () => {
    const [t] = totalsByAttendant([
      { attendant: "Ana", status: "open", restricted: true, overdue: 2 },
      { attendant: "Ana", status: "won", restricted: false, overdue: 0 },
    ]);
    expect(t).toEqual({ attendant: "Ana", cards: 2, open: 1, won: 1, lost: 0, pending: 1, overdue: 1 });
  });
});
