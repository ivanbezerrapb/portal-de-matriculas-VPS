// Regras de destino: decidem se um cadastro vira oportunidade no CRM
// e em qual funil/etapa ele entra. Módulo puro (usado no servidor).
import { formatAddress, parseAddress, parseAddressPartFieldId } from "./model";

export type ConditionOp = "eq" | "neq" | "contains" | "empty" | "not_empty" | "in" | "gt" | "lt";

export const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  eq: "é igual a",
  neq: "é diferente de",
  contains: "contém",
  empty: "está vazio",
  not_empty: "não está vazio",
  in: "está entre",
  gt: "maior que",
  lt: "menor que",
};

export type DestinationCondition = {
  field_id: string;
  op: ConditionOp;
  value: string;
};

export type DestinationRule = {
  id: string;
  form_id: string;
  position: number;
  label: string | null;
  send: boolean;
  funnel_id: string | null;
  stage_id: string | null;
  conditions: DestinationCondition[];
};

// Sentinela usada nas informações adicionais para o ID do cadastro.
export const SUBMISSION_ID_FIELD = "submission_id";

// Campo extra levado para o cartão do CRM.
export type ExtraField = {
  field_id: string;
  label: string | null;
};

export type Destination = {
  form_id: string;
  name_field_id: string | null;
  phone_field_id: string | null;
  email_field_id: string | null;
  extra_fields: ExtraField[];
  // Chave geral: quando desligada, nenhum cadastro do formulário vai para o CRM.
  enabled: boolean;
  default_send: boolean;
  default_funnel_id: string | null;
  default_stage_id: string | null;
};

// Texto legível de uma resposta (inclui múltipla escolha e "N Filhos").
export function answerText(raw: string | string[] | null | undefined): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) return raw.join(", ");
  const s = String(raw).trim();
  if (s.startsWith("{")) return formatAddress(parseAddress(s));
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr
          .map((item) => {
            if (item && typeof item === "object") {
              const c = item as Record<string, unknown>;
              const parts = [c["nome"], c["nascimento"], c["serie"], c["turno"]]
                .map((v) => (v == null ? "" : String(v).trim()))
                .filter(Boolean);
              return parts.join(" · ");
            }
            return String(item);
          })
          .filter(Boolean)
          .join(" | ");
      }
    } catch {
      // texto normal
    }
  }
  return s;
}

export type CrmDecision = {
  send: boolean;
  funnel_id: string | null;
  stage_id: string | null;
  reason: string;
};

// Normaliza o valor gravado para comparação em texto.
function asText(raw: string | string[] | null | undefined): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) return raw.join(", ");
  const s = String(raw).trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((v) => String(v)).join(", ");
    } catch {
      // texto normal
    }
  }
  return s;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Resolve o valor de um campo, incluindo ids sintéticos de parte de endereço.
export function valueByFieldId(
  values: Record<string, string | string[] | null | undefined>,
  fieldId: string,
): string | string[] | null | undefined {
  const syn = parseAddressPartFieldId(fieldId);
  if (syn) {
    const raw = values[syn.fieldId];
    return parseAddress(typeof raw === "string" ? raw : "")[syn.part];
  }
  return values[fieldId];
}

export function matchCondition(
  condition: DestinationCondition,
  values: Record<string, string | string[] | null | undefined>,
): boolean {
  const text = asText(valueByFieldId(values, condition.field_id));
  const target = condition.value ?? "";
  switch (condition.op) {
    case "empty":
      return text === "";
    case "not_empty":
      return text !== "";
    case "eq":
      return norm(text) === norm(target);
    case "neq":
      return norm(text) !== norm(target);
    case "contains":
      return norm(text).includes(norm(target));
    case "in":
      return target
        .split(",")
        .map((t) => norm(t))
        .filter(Boolean)
        .some((t) => norm(text) === t || norm(text).split(", ").includes(t));
    case "gt":
    case "lt": {
      const a = Number(text.replace(",", "."));
      const b = Number(target.replace(",", "."));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        return condition.op === "gt" ? a > b : a < b;
      }
      return condition.op === "gt" ? text > target : text < target;
    }
    default:
      return false;
  }
}

// Vale a primeira regra cujos critérios sejam todos atendidos.
export function evaluateRules(
  values: Record<string, string | string[] | null | undefined>,
  rules: DestinationRule[],
  destination: Destination | null,
): CrmDecision {
  const ordered = [...rules].sort((a, b) => a.position - b.position);
  for (const rule of ordered) {
    const conditions = rule.conditions ?? [];
    const matched = conditions.length > 0 && conditions.every((c) => matchCondition(c, values));
    if (!matched) continue;
    const name = rule.label?.trim() || `Regra ${rule.position + 1}`;
    if (!rule.send) {
      return { send: false, funnel_id: null, stage_id: null, reason: `Bloqueado por: ${name}` };
    }
    return {
      send: true,
      funnel_id: rule.funnel_id,
      stage_id: rule.stage_id,
      reason: `Enviado por: ${name}`,
    };
  }

  if (destination && destination.default_send && destination.default_stage_id) {
    return {
      send: true,
      funnel_id: destination.default_funnel_id,
      stage_id: destination.default_stage_id,
      reason: "Destino padrão do formulário",
    };
  }
  if (destination && !destination.default_send) {
    return {
      send: false,
      funnel_id: null,
      stage_id: null,
      reason: "Destino padrão: não enviar ao CRM",
    };
  }
  return { send: false, funnel_id: null, stage_id: null, reason: "Sem destino configurado" };
}
