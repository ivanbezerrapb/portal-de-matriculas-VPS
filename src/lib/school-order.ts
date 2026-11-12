// Ordem fixa das unidades no portal: Centro, Expedicionários, Cristo, Bessa.
// A comparação ignora acentos, maiúsculas e espaços extras, e aceita nomes que
// contenham a palavra-chave (ex.: "Unidade Centro" conta como "Centro").
const SCHOOL_ORDER_KEYS = ["centro", "expedicionarios", "cristo", "bessa"] as const;

export function normalizeSchoolName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function schoolOrderIndex(name: string): number {
  const normalized = normalizeSchoolName(name);
  const index = SCHOOL_ORDER_KEYS.findIndex((key) => normalized.includes(key));
  return index === -1 ? SCHOOL_ORDER_KEYS.length : index;
}

export function compareSchoolNames(a: string, b: string): number {
  const diff = schoolOrderIndex(a) - schoolOrderIndex(b);
  return diff !== 0 ? diff : a.localeCompare(b, "pt-BR");
}
