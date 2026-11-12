import { createPortal } from "react-dom";
import logo from "@/assets/grupo-inter-logo.png.asset.json";

export type ListReportRow = {
  id: string; publicId: string; responsible: string; school: string; children: string;
  date: string; series: string; attendant: string; funnel: string; status: boolean; checkIn?: string;
  enrolledCount: number;
};

export function enrolledTotal(rows: { enrolledCount?: number }[]): number {
  return rows.reduce((total, r) => total + (Number(r.enrolledCount) || 0), 0);
}

export function ListReport({ title, school, listType, filters, rows, printedBy, printedAt }: {
  title: string; school: string; listType: "visitantes" | "leads"; filters: string[]; rows: ListReportRow[];
  printedBy: string; printedAt: string;
}) {
  if (typeof document === "undefined") return null;
  const statusLabel = listType === "leads" ? "Check-in" : "Matrícula";
  const total = enrolledTotal(rows);
  const enrolledLabel = listType === "leads" ? "compareceram" : "matriculado";
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
          #list-report table { width: 100%; border-collapse: collapse; }
          #list-report thead { display: table-header-group; }
          #list-report tr { break-inside: avoid; }
          #list-report th { background: #2b2a6b; color: #fff; text-align: left; padding: 5px 6px; font-size: 9px; text-transform: uppercase; }
          #list-report td { border-bottom: 1px solid #ddd; padding: 5px 6px; vertical-align: top; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #2b2a6b", paddingBottom: 6, marginBottom: 6 }}>
        <img src={logo.url} alt="Grupo Intereducacional" style={{ height: 34 }} />
        <div style={{ textAlign: "right" }}>
          <div>Impresso em {printedAt}{printedBy ? ` por ${printedBy}` : ""}</div>
        </div>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: "#2b2a6b" }}>{school}</h1>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ marginBottom: 8 }}>
        <strong>Filtros:</strong> {filters.length ? filters.join(" · ") : "Nenhum"} — <strong>{rows.length} cadastro{rows.length === 1 ? "" : "s"}</strong> · <strong>{total} {enrolledLabel}{total === 1 ? "" : "s"}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Responsável</th><th>Escola</th>
            {listType === "visitantes" && <th>Crianças</th>}
            <th>Data</th><th>Série</th><th>Atendimento</th><th>Funil</th><th>{statusLabel}</th>
            {listType === "leads" && <th>Data do check-in</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ fontFamily: "monospace" }}>{r.publicId}</td><td>{r.responsible}</td><td>{r.school}</td>
              {listType === "visitantes" && <td>{r.children}</td>}
              <td>{r.date}</td><td>{r.series}</td><td>{r.attendant}</td><td>{r.funnel}</td>
              <td>{r.status ? "Sim" : "Não"}</td>
              {listType === "leads" && <td>{r.checkIn}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
