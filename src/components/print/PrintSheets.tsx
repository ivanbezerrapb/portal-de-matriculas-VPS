import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPrintData } from "@/lib/ext/impressao.functions";
import type { FormField } from "@/lib/ext/model";
import { formatValue } from "@/components/FieldRenderer";
import { DynamicPrintPage } from "@/components/print/DynamicPrintPage";
import { PAGE_MM, parseLayout, type PrintContext } from "@/lib/ext/print-layout";
import { Spinner } from "@/components/ui";

export type PrintSheetsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      count: number;
      overflow: boolean;
      canPrint: boolean;
    };

export function PrintSheets({
  templateId,
  submissionIds,
  autoPrint = false,
  offscreen = false,
  onStateChange,
  onDone,
}: {
  templateId: string;
  submissionIds: string[];
  autoPrint?: boolean;
  offscreen?: boolean;
  onStateChange?: (state: PrintSheetsState) => void;
  onDone?: () => void;
}) {
  const [pageStatus, setPageStatus] = useState<
    Record<string, { ready: boolean; overflow: boolean }>
  >({});
  const printedRef = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["print", templateId, ...submissionIds],
    queryFn: () =>
      getPrintData({
        data: { template_id: templateId, submission_ids: submissionIds },
      }),
    enabled: submissionIds.length > 0,
  });

  const updatePageStatus = useCallback(
    (key: string, status: { ready: boolean; overflow: boolean }) => {
      setPageStatus((current) => {
        const previous = current[key];
        if (previous?.ready === status.ready && previous.overflow === status.overflow)
          return current;
        return { ...current, [key]: status };
      });
    },
    [],
  );

  const hasData = !!data && data.submissions.length > 0;
  const layout = hasData ? parseLayout(data.template.layout) : null;
  const hasLayout = !!layout && layout.pages.some((p) => p.blocks.length > 0);
  const expectedPages =
    hasData && hasLayout && layout ? data.submissions.length * layout.pages.length : 0;
  const statuses = Object.values(pageStatus);
  const dynamicReady =
    !hasLayout ||
    (expectedPages > 0 &&
      statuses.length === expectedPages &&
      statuses.every((status) => status.ready));
  const hasOverflow = statuses.some((status) => status.overflow);

  useEffect(() => {
    if (!onStateChange) return;
    if (isLoading) {
      onStateChange({ status: "loading" });
      return;
    }
    if (error || !data || data.submissions.length === 0) {
      onStateChange({
        status: "error",
        message:
          error?.message ?? "Nenhum cadastro encontrado para impressão. Verifique suas permissões.",
      });
      return;
    }
    onStateChange({
      status: "ready",
      count: data.submissions.length,
      overflow: hasOverflow,
      canPrint: dynamicReady && !hasOverflow,
    });
  }, [isLoading, error, data, hasOverflow, dynamicReady, onStateChange]);

  useEffect(() => {
    if (!autoPrint || !hasData) return;
    if (hasLayout && statuses.length < expectedPages) return;
    if (hasOverflow) {
      toast.error(
        "Esta ficha possui conteúdo fora do limite da folha. Ajuste o modelo antes de imprimir para evitar dados cortados.",
      );
      onDone?.();
      return;
    }
    if (!dynamicReady || printedRef.current) return;
    printedRef.current = true;
    const firedKey = `${templateId}:${submissionIds.join(",")}`;
    const w = window as unknown as { __printFiredFor?: string };
    if (w.__printFiredFor === firedKey) return;
    w.__printFiredFor = firedKey;
    const after = () => {
      delete w.__printFiredFor;
      onDone?.();
    };
    window.addEventListener("afterprint", after);
    setTimeout(() => window.print(), 100);
    return () => {
      window.removeEventListener("afterprint", after);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, hasData, hasLayout, dynamicReady, hasOverflow, expectedPages]);

  if (isLoading) {
    return (
      <div className={offscreen ? "hidden" : "mt-10 flex justify-center"}>
        <Spinner />
      </div>
    );
  }

  if (error || !data || data.submissions.length === 0) {
    if (offscreen) return null;
    return (
      <p className="mx-auto max-w-xl text-sm text-destructive">
        {error?.message ?? "Nenhum cadastro encontrado para impressão. Verifique suas permissões."}
      </p>
    );
  }

  const { template, form, fields, submissions } = data;
  const school = form.schools as unknown as {
    name: string;
    logo_url: string | null;
  } | null;
  const typedFields = fields as FormField[];
  const layoutFields = ((data as unknown as { allFields?: unknown }).allFields ??
    fields) as FormField[];
  const size = PAGE_MM[layout?.pageSize ?? (template.page_size as "A4" | "A5")];

  const printCss = `
    @media print {
      html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
      body *:not(:has(#print-area)):not(#print-area):not(#print-area *) { display: none !important; }
      body *:has(#print-area) { display: block !important; position: static !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; height: auto !important; width: auto !important; max-width: none !important; overflow: visible !important; transform: none !important; border: none !important; box-shadow: none !important; background: none !important; }
      #print-area { position: static !important; width: auto !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; display: block !important; }
      .print-page { break-after: page; page-break-after: always; break-inside: avoid; box-shadow: none !important; border: none !important; margin: 0 !important; }
      .print-page:last-child { break-after: auto; page-break-after: auto; }
      ${hasLayout ? `.print-page { height: ${size.h - 0.5}mm !important; overflow: hidden !important; }` : ""}
      .no-print { display: none !important; }
    }
    @page { size: ${layout?.pageSize ?? template.page_size}; margin: ${hasLayout ? "0" : "12mm"}; }
  `;

  const shellClass = offscreen ? "print-shell fixed top-0 -left-[10000px]" : "print-shell";

  if (hasLayout && layout) {
    return (
      <div className={shellClass} aria-hidden={offscreen}>
        <style>{printCss}</style>
        <div id="print-area">
          {submissions.map((sub) => {
            const ctx: PrintContext = {
              fields: layoutFields,
              values: sub.values,
              publicId: sub.public_id,
              schoolName: school?.name ?? "",
              formTitle: form.title,
              createdAt: sub.created_at,
            };
            return layout.pages.map((page) => {
              const statusKey = `${sub.id}-${page.id}`;
              return (
                <DynamicPrintPage
                  key={statusKey}
                  page={page}
                  ctx={ctx}
                  width={size.w}
                  height={size.h}
                  className="print-page mx-auto mb-6 bg-white shadow-sm"
                  onStatusChange={(status) => updatePageStatus(statusKey, status)}
                />
              );
            });
          })}
        </div>
      </div>
    );
  }

  // Formato simples (modelos antigos, sem layout montado)
  return (
    <div className={shellClass} aria-hidden={offscreen}>
      <style>{printCss}</style>
      <div id="print-area" className="mx-auto flex max-w-4xl flex-col gap-6">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="print-page rounded-xl border border-border bg-card p-8 shadow-sm"
          >
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                {template.show_logo && school?.logo_url && (
                  <img
                    src={school.logo_url}
                    alt={school.name}
                    className="mb-2 h-12 object-contain"
                  />
                )}
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {school?.name ?? ""}
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">{template.title}</h2>
                {template.header_text && (
                  <p className="mt-1 text-sm text-muted-foreground">{template.header_text}</p>
                )}
              </div>
              <p className="font-mono text-lg font-bold text-foreground">{sub.public_id}</p>
            </div>

            <dl
              className={`mt-5 grid gap-x-8 gap-y-4 ${
                template.columns === 2 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {typedFields.map((field) => (
                <div key={field.id}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                    {formatValue(field, sub.values[field.id] ?? "")}
                  </dd>
                </div>
              ))}
            </dl>

            {template.show_signature && (
              <div className="mt-14 flex justify-center">
                <div className="w-72 border-t border-foreground pt-1 text-center text-xs text-muted-foreground">
                  Assinatura do responsável
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>{template.footer_text ?? ""}</span>
              <span>Impresso em {new Date().toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
