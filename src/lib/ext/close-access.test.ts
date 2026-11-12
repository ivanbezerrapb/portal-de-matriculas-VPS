import { describe, expect, it } from "vitest";
import { canCloseOpportunity } from "./close-access";

const SCHOOL = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const base = {
  isAdmin: false,
  isDirecao: false,
  managerSchools: [] as string[],
  infoSchools: [] as string[],
};

describe("canCloseOpportunity", () => {
  it("Central de Informações vinculada ao funil pode marcar como ganha", () => {
    const perms = { ...base, infoSchools: [SCHOOL] };
    expect(canCloseOpportunity(perms, SCHOOL, true)).toBe(true);
  });
  it("Central de Informações fora do funil não pode", () => {
    const perms = { ...base, infoSchools: [SCHOOL] };
    expect(canCloseOpportunity(perms, SCHOOL, false)).toBe(false);
  });
  it("Central de Informações de outra unidade não pode", () => {
    const perms = { ...base, infoSchools: [SCHOOL] };
    expect(canCloseOpportunity(perms, OTHER, true)).toBe(false);
  });
  it("Admin sempre pode", () => {
    expect(canCloseOpportunity({ ...base, isAdmin: true }, OTHER, false)).toBe(true);
  });
  it("Gerente da unidade pode", () => {
    expect(canCloseOpportunity({ ...base, managerSchools: [SCHOOL] }, SCHOOL, false)).toBe(true);
  });
  it("Direção é somente leitura", () => {
    const perms = { ...base, isDirecao: true, infoSchools: [SCHOOL], managerSchools: [SCHOOL] };
    expect(canCloseOpportunity(perms, SCHOOL, true)).toBe(false);
  });
  it("Direção que também é admin pode", () => {
    const perms = { ...base, isDirecao: true, isAdmin: true };
    expect(canCloseOpportunity(perms, SCHOOL, false)).toBe(true);
  });
  it("Perfil sem vínculo com a unidade não pode", () => {
    expect(canCloseOpportunity(base, SCHOOL, true)).toBe(false);
  });
});

import { asksEnrollment } from "./close-access";
describe("asksEnrollment", () => {
  it("Visitantes pede matrícula", () => {
    expect(asksEnrollment({ submission_id: "x", submissions: { list_type: "visitors" } })).toBe(true);
  });
  it("LEADS não pede matrícula", () => {
    expect(asksEnrollment({ submission_id: "x", submissions: { list_type: "leads" } })).toBe(false);
  });
  it("sem ficha não pede", () => {
    expect(asksEnrollment({ submission_id: null })).toBe(false);
  });
});
