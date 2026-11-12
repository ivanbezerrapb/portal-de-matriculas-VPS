// Modelo de layout visual da impressão (arrastar e soltar).
import {
  ADDRESS_PART_LABELS,
  parseAddressPartFieldId,
  parseChildren,
  type ChildEntry,
  type FormField,
} from "./model";

export type PageSizeName = "A4" | "A5";

export const PAGE_MM: Record<PageSizeName, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
};

export const MM_PX = 96 / 25.4; // 1mm em pixels de tela

export type Align = "left" | "center" | "right" | "justify";

export type BlockBase = {
  id: string;
  x: number; // mm
  y: number; // mm
  w: number; // mm
  h: number; // mm
};

export type TextBlock = BlockBase & {
  type: "text";
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: Align;
  color: string;
};

export type FieldBlock = BlockBase & {
  type: "field";
  source: string;
  showLabel: boolean;
  labelText: string;
  fontSize: number;
  bold: boolean;
  align: Align;
};

export type ImageBlock = BlockBase & {
  type: "image";
  url: string;
  fit: "contain" | "cover";
};

export type BoxBlock = BlockBase & {
  type: "box";
  border: number;
  radius: number;
  fill: string; // "" = transparente
};

export type LinesBlock = BlockBase & {
  type: "lines";
  count: number;
};

export type SignatureBlock = BlockBase & {
  type: "signature";
  caption: string;
  fontSize: number;
};

export type TableCell = {
  text: string;
  source: string; // "" = texto fixo
  bold: boolean;
  align: Align;
};

export type TableBlock = BlockBase & {
  type: "table";
  cols: number[]; // pesos relativos de largura
  rowHeights: number[]; // pesos relativos de altura
  header: boolean;
  fontSize: number;
  rows: TableCell[][];
};

export type ChildrenBlock = BlockBase & {
  type: "children";
  fieldId: string;
  mode: "list" | "table";
  fontSize: number;
};

export type PrintBlock =
  | TextBlock
  | FieldBlock
  | ImageBlock
  | BoxBlock
  | LinesBlock
  | SignatureBlock
  | TableBlock
  | ChildrenBlock;

export type PrintPage = { id: string; blocks: PrintBlock[] };

export type PrintLayout = {
  version: 1;
  pageSize: PageSizeName;
  pages: PrintPage[];
};

export const BLOCK_LABELS: Record<PrintBlock["type"], string> = {
  text: "Texto fixo",
  field: "Dado do cadastro",
  image: "Imagem",
  box: "Caixa / moldura",
  lines: "Linhas para preencher",
  signature: "Assinatura",
  table: "Tabela",
  children: "Lista de crianças",
};

// Fontes especiais além dos campos do formulário.
export const SPECIAL_SOURCES: { value: string; label: string }[] = [
  { value: "__public_id", label: "Nº da ficha (ID)" },
  { value: "__school_name", label: "Nome da escola" },
  { value: "__form_title", label: "Título do formulário" },
  { value: "__created_at", label: "Data/hora do cadastro" },
  { value: "__today", label: "Data de hoje (impressão)" },
];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyLayout(pageSize: PageSizeName = "A4"): PrintLayout {
  return { version: 1, pageSize, pages: [{ id: uid(), blocks: [] }] };
}

export function parseLayout(raw: unknown): PrintLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as PrintLayout;
  if (!Array.isArray(l.pages) || l.pages.length === 0) return null;
  return {
    version: 1,
    pageSize: l.pageSize === "A5" ? "A5" : "A4",
    pages: l.pages.map((p) => ({
      id: p.id || uid(),
      blocks: Array.isArray(p.blocks) ? p.blocks : [],
    })),
  };
}

export function newBlock(type: PrintBlock["type"]): PrintBlock {
  const base = { id: uid(), x: 15, y: 15, w: 80, h: 12 };
  switch (type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: "Texto",
        fontSize: 11,
        bold: false,
        italic: false,
        underline: false,
        align: "left",
        color: "#000000",
      };
    case "field":
      return {
        ...base,
        type: "field",
        source: "__public_id",
        showLabel: true,
        labelText: "",
        fontSize: 11,
        bold: false,
        align: "left",
      };
    case "image":
      return { ...base, h: 25, type: "image", url: "", fit: "contain" };
    case "box":
      return {
        ...base,
        w: 70,
        h: 30,
        type: "box",
        border: 0.4,
        radius: 0,
        fill: "",
      };
    case "lines":
      return { ...base, w: 170, h: 30, type: "lines", count: 5 };
    case "signature":
      return {
        ...base,
        w: 90,
        h: 14,
        type: "signature",
        caption: "Assinatura do Responsável",
        fontSize: 9,
      };
    case "children":
      return {
        ...base,
        w: 170,
        h: 30,
        type: "children",
        fieldId: "",
        mode: "list",
        fontSize: 10,
      };
    case "table":
    default:
      return {
        ...base,
        w: 170,
        h: 40,
        type: "table",
        cols: [1, 2, 1],
        rowHeights: [1, 2],
        header: true,
        fontSize: 10,
        rows: [
          [cell("COLUNA 1", true), cell("COLUNA 2", true), cell("COLUNA 3", true)],
          [cell(""), cell(""), cell("")],
        ],
      };
  }
}

export function cell(text = "", bold = false): TableCell {
  return { text, source: "", bold, align: bold ? "center" : "left" };
}

export type PrintContext = {
  fields: FormField[];
  values: Record<string, string>;
  publicId: string;
  schoolName: string;
  formTitle: string;
  createdAt: string;
};

export function sourceLabel(source: string, fields: FormField[]): string {
  const special = SPECIAL_SOURCES.find((s) => s.value === source);
  if (special) return special.label;
  const syn = parseAddressPartFieldId(source);
  if (syn) {
    const parent = fields.find((f) => f.id === syn.fieldId)?.label ?? "Endereço";
    return `${parent} — ${ADDRESS_PART_LABELS[syn.part]}`;
  }
  return fields.find((f) => f.id === source)?.label ?? "Campo removido";
}

export function childrenOf(block: ChildrenBlock, ctx: PrintContext): ChildEntry[] {
  const fallback = ctx.fields.find((f) => f.type === "children" && !f.internal)?.id ?? "";
  // O template pode vir de outro formulário: se o campo indicado não existir
  // ou não for do tipo "N Filhos", usamos o campo de crianças deste formulário.
  let fieldId = block.fieldId || fallback;
  const configuredField = ctx.fields.find((f) => f.id === fieldId);
  const validChildrenField = configuredField?.type === "children" && !configuredField.internal;
  if (!validChildrenField || !(ctx.values[fieldId] ?? "").trim()) {
    if (fallback && (ctx.values[fallback] ?? "").trim()) fieldId = fallback;
  }
  if (!fieldId) return [];
  return parseChildren(ctx.values[fieldId] ?? "");
}

// ---------- Reaproveitamento de layouts entre formulários ----------

export function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// IDs de campos usados dentro de um layout (ignora fontes especiais "__").
export function collectLayoutFieldIds(layout: PrintLayout | null): string[] {
  const ids = new Set<string>();
  for (const page of layout?.pages ?? []) {
    for (const block of page.blocks) {
      if (block.type === "field" && block.source && !block.source.startsWith("__")) {
        ids.add(block.source);
      }
      if (block.type === "children" && block.fieldId) ids.add(block.fieldId);
      if (block.type === "table") {
        for (const row of block.rows) {
          for (const c of row) {
            if (c.source && !c.source.startsWith("__")) ids.add(c.source);
          }
        }
      }
    }
  }
  return [...ids];
}

// Troca os IDs de campos do layout usando um mapa antigo -> novo.
// IDs sem correspondência são mantidos (aparecem como "Campo removido").
export function remapLayoutFields(
  layout: PrintLayout | null,
  map: Record<string, string | undefined>,
): PrintLayout | null {
  if (!layout) return null;
  const fix = (id: string) => (id && map[id] ? map[id]! : id);
  return {
    ...layout,
    pages: layout.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => {
        if (b.type === "field" && b.source && !b.source.startsWith("__")) {
          return { ...b, source: fix(b.source) };
        }
        if (b.type === "children" && b.fieldId) {
          return { ...b, fieldId: fix(b.fieldId) };
        }
        if (b.type === "table") {
          return {
            ...b,
            rows: b.rows.map((row) =>
              row.map((c) =>
                c.source && !c.source.startsWith("__") ? { ...c, source: fix(c.source) } : c,
              ),
            ),
          };
        }
        return b;
      }),
    })),
  };
}

// Monta o mapa antigo -> novo casando campos pelo rótulo (sem acentos/maiúsculas).
export function mapFieldsByLabel(
  sourceLabels: {
    id: string;
    label: string;
    type?: string | undefined;
    internal?: boolean | undefined;
  }[],
  targetFields: {
    id: string;
    label: string;
    type?: string | undefined;
    internal?: boolean | undefined;
  }[],
): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const s of sourceLabels) {
    const candidates = targetFields.filter(
      (f) => normalizeLabel(f.label) === normalizeLabel(s.label),
    );
    const sameType = s.type
      ? (candidates.find((f) => f.type === s.type && Boolean(f.internal) === Boolean(s.internal)) ??
        candidates.find((f) => f.type === s.type && !f.internal))
      : undefined;
    const visible = candidates.find((f) => !f.internal);
    const hit = sameType ?? visible ?? candidates[0];
    if (hit) map[s.id] = hit.id;
  }
  return map;
}

export function formatDateTimeBR(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
