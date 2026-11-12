// Regras puras dos relatórios (testadas em relatorios-logic.test.ts).
import { compareSchoolNames } from "@/lib/school-order";

export type EnrolledRow = { school: string; series: string[]; count: number };

/** Soma de matrículas por unidade (ordem padrão das unidades). */
export function totalsBySchool(rows: EnrolledRow[]): { label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.school, (m.get(r.school) ?? 0) + r.count);
  return [...m].map(([label, total]) => ({ label, total })).sort((a, b) => compareSchoolNames(a.label, b.label));
}

/** Soma por série: cada criança/série vale 1; sem série, a quantidade vai para "Sem série". */
export function totalsBySeries(rows: EnrolledRow[]): { label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.series.length === 0) m.set("Sem série", (m.get("Sem série") ?? 0) + r.count);
    else for (const s of r.series) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return [...m].map(([label, total]) => ({ label, total })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
}

/** Tarefas não concluídas com vencimento anterior a hoje (data AAAA-MM-DD). */
export function countOverdue(tasks: { done: boolean; due_date: string | null }[], today: string): number {
  return tasks.filter((t) => !t.done && t.due_date && t.due_date.slice(0, 10) < today).length;
}

export type AttendanceRow = { attendant: string; status: "open" | "won" | "lost"; restricted: boolean; overdue: number };
export type AttendantTotal = { attendant: string; cards: number; open: number; won: number; lost: number; pending: number; overdue: number };

export function totalsByAttendant(rows: AttendanceRow[]): AttendantTotal[] {
  const m = new Map<string, AttendantTotal>();
  for (const r of rows) {
    const k = r.attendant || "Sem atendente";
    const t = m.get(k) ?? { attendant: k, cards: 0, open: 0, won: 0, lost: 0, pending: 0, overdue: 0 };
    t.cards++;
    t[r.status]++;
    if (r.restricted) t.pending++;
    if (r.overdue > 0) t.overdue++;
    m.set(k, t);
  }
  return [...m.values()].sort((a, b) => b.cards - a.cards || a.attendant.localeCompare(b.attendant, "pt-BR"));
}
