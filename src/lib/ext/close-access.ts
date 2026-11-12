// Regra única de quem pode fechar um cartão do CRM (ganho ou perda).
// Admin sempre pode; Gerente da unidade pode; Central de Informações só pode
// quando está vinculada ao funil do cartão. Direção é somente leitura.

export type CloseAccessPerms = {
  isAdmin: boolean;
  isDirecao: boolean;
  managerSchools: string[];
  infoSchools: string[];
};

export function canCloseOpportunity(
  perms: CloseAccessPerms,
  schoolId: string,
  linkedToFunnel: boolean,
): boolean {
  if (perms.isAdmin) return true;
  if (perms.isDirecao) return false;
  if (perms.managerSchools.includes(schoolId)) return true;
  if (perms.infoSchools.includes(schoolId)) return linkedToFunnel;
  return false;
}

// Leitura da interface: o vínculo ao funil é conferido no servidor.
export function canCloseOpportunityBySchool(
  perms: CloseAccessPerms,
  schoolId: string,
): boolean {
  return canCloseOpportunity(perms, schoolId, true);
}

// Ganho pede/grava matrícula só para cartões da Lista de Visitantes (não para LEADS).
export function asksEnrollment(
  opp: { submission_id: string | null; submissions?: { list_type: string | null } | null } | null,
): boolean {
  if (!opp?.submission_id) return false;
  return opp.submissions?.list_type !== "leads";
}
