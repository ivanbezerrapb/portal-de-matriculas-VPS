import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import logo from "@/assets/grupo-inter-logo.png.asset.json";

/** Relatório genérico A4 deitado (mesmo visual da impressão das listas). */
export function ReportPrint({ title, school, filters, summary, columns, rows, printedBy, printedAt, extra }: {
  title: string; school: string; filters: string[]; summary: string; columns: string[]; rows: (string | number)[][];
  printedBy: string; printedAt: string; extra?: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div id="list-report">
      <style>{`
        @media screen { #list-report { display: none; } }
        @media print {
          @page { size: A4 landscape; margin: 10mm 10mm 14mm;
            @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size: 9px; color: #555; } }
          body.list-report-printing > *:not(#list-report) { display: none !important; }
          #list-report { display: block; font-family: system-ui, sans-serif; color: #111; font-size: 10px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #list-report table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          #list-report thead { display: table-header-group; }
          #list-report tr { break-inside: avoid; }
          #list-report th { background: #2b2a6b; color: #fff; text-align: left; padding: 5px 6px; font-size: 9px; text-transform: uppercase; }
          #list-report td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #2b2a6b", paddingBottom: 6, marginBottom: 6 }}>
        <img src={logo.url} alt="Grupo Intereducacional" style={{ height: 34 }} />
        <div>Impresso em {printedAt}{printedBy ? ` por ${printedBy}` : ""}</div>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: "#2b2a6b" }}>{title} — {school}</h1>
      <div style={{ marginBottom: 8 }}>
        <strong>Filtros:</strong> {filters.length ? filters.join(" · ") : "Nenhum"} — <strong>{summary}</strong>
      </div>
      {extra}
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>,
    document.body,
  );
}

export function SmallTable({ title, columns, rows }: { title: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{title}</div>
      <table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

export function printNow() {
  setTimeout(() => {
    document.body.classList.add("list-report-printing");
    const done = () => { document.body.classList.remove("list-report-printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }, 100);
}
