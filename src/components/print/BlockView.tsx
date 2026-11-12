// Renderização de um bloco do layout — usada no editor e na impressão.
import { formatValue } from "@/components/FieldRenderer";
import { parseAddress, parseAddressPartFieldId } from "@/lib/ext/model";
import {
  childrenOf,
  formatDateTimeBR,
  sourceLabel,
  type ChildrenBlock,
  type PrintBlock,
  type PrintContext,
  type TableBlock,
} from "@/lib/ext/print-layout";

export function resolveSource(source: string, ctx: PrintContext): string {
  switch (source) {
    case "__public_id":
      return ctx.publicId;
    case "__school_name":
      return ctx.schoolName;
    case "__form_title":
      return ctx.formTitle;
    case "__created_at":
      return formatDateTimeBR(ctx.createdAt);
    case "__today":
      return new Date().toLocaleDateString("pt-BR");
    default: {
      // Parte de um campo Endereço ("<campo>.<parte>", ex.: CEP, Rua).
      const syn = parseAddressPartFieldId(source);
      if (syn) return parseAddress(ctx.values[syn.fieldId] ?? "")[syn.part];
      const field = ctx.fields.find((f) => f.id === source);
      if (!field) return "";
      return formatValue(field, ctx.values[field.id] ?? "");
    }
  }
}

function mm(v: number) {
  return `${v}mm`;
}

export function BlockView({
  block,
  ctx,
  preview,
}: {
  block: PrintBlock;
  ctx: PrintContext;
  preview: boolean; // true = mostra rótulos de exemplo no editor
}) {
  switch (block.type) {
    case "text":
      return (
        <div
          style={{
            fontSize: mm(block.fontSize * 0.3528),
            fontWeight: block.bold ? 700 : 400,
            fontStyle: block.italic ? "italic" : "normal",
            textDecoration: block.underline ? "underline" : "none",
            textAlign: block.align,
            color: block.color,
            whiteSpace: "pre-wrap",
            lineHeight: 1.35,
            width: "100%",
            height: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {block.text}
        </div>
      );

    case "field": {
      const label = block.labelText || sourceLabel(block.source, ctx.fields);
      const value = preview
        ? resolveSource(block.source, ctx) || `[${label}]`
        : resolveSource(block.source, ctx);
      return (
        <div
          style={{
            fontSize: mm(block.fontSize * 0.3528),
            textAlign: block.align,
            whiteSpace: "pre-wrap",
            lineHeight: 1.35,
            width: "100%",
            height: "100%",
            overflowWrap: "anywhere",
          }}
        >
          {block.showLabel && <span>{label}: </span>}
          <span style={{ fontWeight: block.bold ? 700 : 400 }}>{value}</span>
        </div>
      );
    }

    case "image":
      return block.url ? (
        <img
          src={block.url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: block.fit,
            objectPosition: "left center",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1px dashed #999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8pt",
            color: "#888",
          }}
        >
          Imagem
        </div>
      );

    case "box":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `${block.border}mm solid #000`,
            borderRadius: mm(block.radius),
            background: block.fill || "transparent",
          }}
        />
      );

    case "lines": {
      const count = Math.max(1, block.count);
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ borderBottom: "0.25mm dotted #333", height: "1px" }} />
          ))}
        </div>
      );
    }

    case "signature":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%", borderTop: "0.3mm solid #000" }} />
          <div
            style={{
              fontSize: mm(block.fontSize * 0.3528),
              marginTop: "1mm",
              textAlign: "center",
            }}
          >
            {block.caption}
          </div>
        </div>
      );

    case "table":
      return <TableView block={block} ctx={ctx} preview={preview} />;

    case "children":
      return <ChildrenView block={block} ctx={ctx} preview={preview} />;

    default:
      return null;
  }
}

function TableView({
  block,
  ctx,
  preview,
}: {
  block: TableBlock;
  ctx: PrintContext;
  preview: boolean;
}) {
  const totalCols = block.cols.reduce((a, b) => a + b, 0) || 1;
  const totalRows = block.rowHeights.reduce((a, b) => a + b, 0) || 1;
  return (
    <table
      style={{
        width: "100%",
        height: "100%",
        borderCollapse: "collapse",
        fontSize: `${block.fontSize * 0.3528}mm`,
        tableLayout: "fixed",
      }}
    >
      <tbody>
        {block.rows.map((row, ri) => (
          <tr
            key={ri}
            style={{
              height: `${((block.rowHeights[ri] ?? 1) / totalRows) * 100}%`,
            }}
          >
            {row.map((c, ci) => {
              const isHeader = block.header && ri === 0;
              const value = c.source
                ? preview
                  ? resolveSource(c.source, ctx) || `[${sourceLabel(c.source, ctx.fields)}]`
                  : resolveSource(c.source, ctx)
                : c.text;
              return (
                <td
                  key={ci}
                  style={{
                    width: `${((block.cols[ci] ?? 1) / totalCols) * 100}%`,
                    border: "0.25mm solid #000",
                    background: isHeader ? "#d9d9d9" : "transparent",
                    fontWeight: c.bold || isHeader ? 700 : 400,
                    textAlign: c.align,
                    verticalAlign: "top",
                    padding: "1mm",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChildrenView({
  block,
  ctx,
  preview,
}: {
  block: ChildrenBlock;
  ctx: PrintContext;
  preview: boolean;
}) {
  const list = childrenOf(block, ctx);
  const fs = `${block.fontSize * 0.3528}mm`;

  if (list.length === 0) {
    return (
      <div style={{ fontSize: fs, color: preview ? "#888" : "#000" }}>
        {preview ? "[Lista de crianças]" : ""}
      </div>
    );
  }

  if (block.mode === "table") {
    return (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: fs,
          tableLayout: "fixed",
        }}
      >
        <tbody>
          <tr>
            {["NOME", "NASCIMENTO", "SÉRIE", "TURNO"].map((h) => (
              <th
                key={h}
                style={{
                  border: "0.25mm solid #000",
                  background: "#d9d9d9",
                  padding: "1mm",
                  textAlign: "center",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
          {list.map((c, i) => (
            <tr key={i}>
              <td style={{ ...cellStyle, overflowWrap: "anywhere" }}>{c.nome}</td>
              <td style={cellStyle}>{formatBR(c.nascimento)}</td>
              <td style={cellStyle}>{c.serie}</td>
              <td style={cellStyle}>{c.turno}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ fontSize: fs, lineHeight: 1.5 }}>
      {list.map((c, i) => (
        <div key={i}>
          {c.nome} ({formatBR(c.nascimento)}) - {c.serie} - {c.turno}
        </div>
      ))}
    </div>
  );
}

const cellStyle = {
  border: "0.25mm solid #000",
  padding: "1mm",
} as const;

function formatBR(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const [y, m, d] = raw.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
