// Editor visual (arrastar e soltar) do layout de impressão.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/ext/browser";
import { getSubmission, listSubmissions } from "@/lib/ext/cadastros.functions";
import { BlockView } from "@/components/print/BlockView";
import { DynamicPrintPage } from "@/components/print/DynamicPrintPage";
import {
  BLOCK_LABELS,
  MM_PX,
  PAGE_MM,
  SPECIAL_SOURCES,
  cell,
  newBlock,
  uid,
  type PageSizeName,
  type PrintBlock,
  type PrintContext,
  type PrintLayout,
  type TableBlock,
} from "@/lib/ext/print-layout";
import { fieldOptionsWithAddressParts, type FormField } from "@/lib/ext/model";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

const BLOCK_ORDER: PrintBlock["type"][] = [
  "text",
  "field",
  "image",
  "table",
  "box",
  "lines",
  "signature",
  "children",
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function LayoutEditor({
  layout,
  onChange,
  fields,
  formTitle,
  schoolName,
  formId,
}: {
  layout: PrintLayout;
  onChange: (l: PrintLayout) => void;
  fields: FormField[];
  formTitle: string;
  schoolName: string;
  formId: string;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitZoom, setFitZoom] = useState(0.75);
  const [snap, setSnap] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const size = PAGE_MM[layout.pageSize];
  const page = layout.pages[Math.min(pageIdx, layout.pages.length - 1)];
  const activeZoom = zoom === "fit" ? fitZoom : zoom;
  const scale = MM_PX * activeZoom;

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pageIdRef = useRef(page?.id);
  pageIdRef.current = page?.id;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || zoom !== "fit") return;

    const fit = () => {
      const availableWidth = Math.max(280, viewport.clientWidth - 32);
      const availableHeight = Math.max(320, viewport.clientHeight - 32);
      setFitZoom(
        Math.max(
          0.25,
          Math.min(1, availableWidth / (size.w * MM_PX), availableHeight / (size.h * MM_PX)),
        ),
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fullscreen, size.h, size.w, zoom]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const ctx: PrintContext = {
    fields,
    values: {},
    publicId: "0001/ESCOLA",
    schoolName,
    formTitle,
    createdAt: new Date().toISOString(),
  };

  const selectedBlocks = (page?.blocks ?? []).filter((b) => selectedIds.includes(b.id));
  const selected = selectedBlocks.length === 1 ? selectedBlocks[0] : null;

  function setPages(pages: PrintLayout["pages"]) {
    onChange({ ...layoutRef.current, pages });
  }

  function updateBlock(id: string, patch: Partial<PrintBlock>) {
    if (!page) return;
    setPages(
      layoutRef.current.pages.map((p) =>
        p.id === page.id
          ? {
              ...p,
              blocks: p.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as PrintBlock) : b)),
            }
          : p,
      ),
    );
  }

  function applyPositions(map: Record<string, { x: number; y: number }>) {
    const pid = pageIdRef.current;
    if (!pid) return;
    onChange({
      ...layoutRef.current,
      pages: layoutRef.current.pages.map((p) =>
        p.id === pid
          ? {
              ...p,
              blocks: p.blocks.map((b) => (map[b.id] ? ({ ...b, ...map[b.id] } as PrintBlock) : b)),
            }
          : p,
      ),
    });
  }

  function addBlock(type: PrintBlock["type"]) {
    if (!page) return;
    const b = newBlock(type);
    if (type === "children") {
      const cf = fields.find((f) => f.type === "children");
      if (cf) (b as { fieldId: string }).fieldId = cf.id;
    }
    setPages(layout.pages.map((p) => (p.id === page.id ? { ...p, blocks: [...p.blocks, b] } : p)));
    setSelectedIds([b.id]);
  }

  function removeBlocks(ids: string[]) {
    if (!page || ids.length === 0) return;
    setPages(
      layoutRef.current.pages.map((p) =>
        p.id === page.id ? { ...p, blocks: p.blocks.filter((b) => !ids.includes(b.id)) } : p,
      ),
    );
    setSelectedIds([]);
  }

  function duplicateBlocks(ids: string[]) {
    if (!page || ids.length === 0) return;
    const copies = page.blocks
      .filter((b) => ids.includes(b.id))
      .map((b) => ({ ...b, id: uid(), x: b.x + 5, y: b.y + 5 }) as PrintBlock);
    setPages(
      layout.pages.map((p) => (p.id === page.id ? { ...p, blocks: [...p.blocks, ...copies] } : p)),
    );
    setSelectedIds(copies.map((c) => c.id));
  }

  function round(v: number) {
    return snapRef.current ? Math.round(v) : Math.round(v * 10) / 10;
  }

  // Teclado: apagar e mover a seleção.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ids = selectedRef.current;
      if (ids.length === 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeBlocks(ids);
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = deltas[event.key];
      if (!d) return;
      event.preventDefault();
      const pid = pageIdRef.current;
      const current = layoutRef.current.pages.find((p) => p.id === pid);
      if (!current) return;
      const map: Record<string, { x: number; y: number }> = {};
      current.blocks
        .filter((b) => ids.includes(b.id))
        .forEach((b) => {
          map[b.id] = {
            x: Math.max(0, b.x + d[0]),
            y: Math.max(0, b.y + d[1]),
          };
        });
      applyPositions(map);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl + roda do mouse: zoom ancorado no cursor.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const currentZoom = scaleRef.current / MM_PX;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * Math.exp(-dy * 0.0015)));
      if (Math.abs(next - currentZoom) < 0.001) return;
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left + viewport.scrollLeft;
      const py = event.clientY - rect.top + viewport.scrollTop;
      const k = next / currentZoom;
      setZoom(next);
      requestAnimationFrame(() => {
        viewport.scrollLeft += px * (k - 1);
        viewport.scrollTop += py * (k - 1);
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  function changeZoom(delta: number) {
    const current = zoom === "fit" ? fitZoom : zoom;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((current + delta) * 100) / 100)));
  }

  function startDrag(e: React.PointerEvent, block: PrintBlock, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();

    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    let ids = selectedRef.current;
    if (multi) {
      ids = ids.includes(block.id) ? ids.filter((id) => id !== block.id) : [...ids, block.id];
      setSelectedIds(ids);
      if (!ids.includes(block.id)) return;
    } else if (!ids.includes(block.id)) {
      ids = [block.id];
      setSelectedIds(ids);
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const blocks = (
      layoutRef.current.pages.find((p) => p.id === pageIdRef.current)?.blocks ?? []
    ).filter((b) => (mode === "move" ? ids.includes(b.id) : b.id === block.id));
    const origins = blocks.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scaleRef.current;
      const dy = (ev.clientY - startY) / scaleRef.current;
      if (mode === "move") {
        const map: Record<string, { x: number; y: number }> = {};
        origins.forEach((o) => {
          map[o.id] = {
            x: Math.max(0, round(o.x + dx)),
            y: Math.max(0, round(o.y + dy)),
          };
        });
        applyPositions(map);
      } else {
        const o = origins[0];
        if (!o) return;
        updateBlock(o.id, {
          w: Math.max(5, round(o.w + dx)),
          h: Math.max(4, round(o.h + dy)),
        });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startMarquee(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const base = additive ? selectedRef.current : [];
    if (!additive) setSelectedIds([]);
    let moved = false;

    function onMove(ev: PointerEvent) {
      const cx = (ev.clientX - rect.left) / scaleRef.current;
      const cy = (ev.clientY - rect.top) / scaleRef.current;
      const box = {
        x: Math.min(startX, cx),
        y: Math.min(startY, cy),
        w: Math.abs(cx - startX),
        h: Math.abs(cy - startY),
      };
      if (box.w < 1 && box.h < 1) return;
      moved = true;
      setMarquee(box);
      const blocks = layoutRef.current.pages.find((p) => p.id === pageIdRef.current)?.blocks ?? [];
      const hit = blocks
        .filter(
          (b) =>
            b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y,
        )
        .map((b) => b.id);
      setSelectedIds([...new Set([...base, ...hit])]);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved && !additive) setSelectedIds([]);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-background p-4"
          : "flex flex-col"
      }
    >
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {fullscreen ? "Editor de layout em tela cheia" : "Área de montagem"}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            Pré-visualizar impressão
          </Button>
          <Button
            variant="outline"
            onClick={() => setFullscreen((current) => !current)}
            title={fullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Barra de blocos + canvas */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {BLOCK_ORDER.map((t) => (
              <Button
                key={t}
                variant="outline"
                className="px-2.5 py-1 text-xs"
                onClick={() => addBlock(t)}
              >
                + {BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              {layout.pages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPageIdx(i);
                    setSelectedIds([]);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    i === pageIdx
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Página {i + 1}
                </button>
              ))}
              <button
                className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
                onClick={() => {
                  setPages([...layout.pages, { id: uid(), blocks: [] }]);
                  setPageIdx(layout.pages.length);
                }}
              >
                + Página
              </button>
              {layout.pages.length > 1 && (
                <button
                  className="rounded-md px-2 py-1 text-xs text-destructive"
                  onClick={() => {
                    if (!page) return;
                    if (!window.confirm("Excluir esta página do modelo?")) return;
                    const rest = layout.pages.filter((p) => p.id !== page.id);
                    setPages(rest);
                    setPageIdx(0);
                  }}
                >
                  Excluir página
                </button>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="accent-[var(--color-primary)]"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />
              Alinhar à grade
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => changeZoom(-0.1)}
                title="Afastar"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(activeZoom * 100)}%
              </span>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => changeZoom(0.1)}
                title="Aproximar"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${
                  zoom === "fit"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
                onClick={() => setZoom("fit")}
              >
                Ajustar à tela
              </button>
            </div>

            {selectedIds.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {selectedIds.length} blocos selecionados
                </span>
                <button
                  className="rounded-md px-2 py-1 text-destructive"
                  onClick={() => removeBlocks(selectedIds)}
                >
                  Excluir selecionados ({selectedIds.length})
                </button>
              </div>
            )}
          </div>

          <div
            ref={viewportRef}
            className={`mt-3 flex min-h-[32rem] flex-1 items-start justify-center overflow-auto rounded-xl border border-border bg-muted/40 p-4 ${
              fullscreen ? "h-full" : "max-h-[calc(100vh-13rem)]"
            }`}
          >
            <div
              ref={canvasRef}
              onPointerDown={startMarquee}
              style={{
                position: "relative",
                flex: "none",
                width: size.w * scale,
                height: size.h * scale,
                background: "#fff",
                boxShadow: "0 1px 8px rgba(0,0,0,.15)",
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.05) 1px, transparent 1px)",
                backgroundSize: `${10 * scale}px ${10 * scale}px`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: size.w * MM_PX,
                  height: size.h * MM_PX,
                  transform: `scale(${activeZoom})`,
                  transformOrigin: "top left",
                }}
              >
                {(page?.blocks ?? []).map((b) => (
                  <div
                    key={b.id}
                    onPointerDown={(e) => startDrag(e, b, "move")}
                    style={{
                      position: "absolute",
                      left: `${b.x}mm`,
                      top: `${b.y}mm`,
                      width: `${b.w}mm`,
                      height: `${b.h}mm`,
                      outline: selectedIds.includes(b.id)
                        ? "1.5px solid var(--color-primary)"
                        : "1px dashed rgba(0,0,0,.18)",
                      background: selectedIds.includes(b.id) ? "rgba(37,99,235,.06)" : undefined,
                      cursor: "move",
                      overflow: "hidden",
                    }}
                  >
                    <BlockView block={b} ctx={ctx} preview />
                    {selected?.id === b.id && (
                      <div
                        onPointerDown={(e) => startDrag(e, b, "resize")}
                        style={{
                          position: "absolute",
                          right: -4,
                          bottom: -4,
                          width: 10,
                          height: 10,
                          background: "var(--color-primary)",
                          borderRadius: 2,
                          cursor: "nwse-resize",
                        }}
                      />
                    )}
                  </div>
                ))}
                {marquee && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${marquee.x}mm`,
                      top: `${marquee.y}mm`,
                      width: `${marquee.w}mm`,
                      height: `${marquee.h}mm`,
                      border: "1px solid var(--color-primary)",
                      background: "rgba(37,99,235,.10)",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Inspetor */}
        <div className="w-full shrink-0 lg:w-80">
          <div className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {selectedBlocks.length > 1 ? (
              <div>
                <p className="font-medium text-foreground">
                  {selectedBlocks.length} blocos selecionados
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Arraste qualquer um deles para mover todos juntos, ou use as setas do teclado.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="px-2.5 py-1 text-xs"
                    onClick={() => duplicateBlocks(selectedIds)}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2.5 py-1 text-xs"
                    onClick={() => removeBlocks(selectedIds)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ) : !selected ? (
              <p className="text-sm text-muted-foreground">
                Clique em um bloco para editar suas propriedades, ou adicione um novo bloco acima.
                Segure Ctrl para selecionar vários, ou arraste sobre a folha vazia para selecionar
                por área.
              </p>
            ) : (
              <Inspector
                block={selected}
                fields={fields}
                onChange={(patch) => updateBlock(selected.id, patch)}
                onDuplicate={() => duplicateBlocks([selected.id])}
                onRemove={() => removeBlocks([selected.id])}
              />
            )}
          </div>
        </div>
      </div>

      {previewOpen && (
        <PrintPreviewDialog
          formId={formId}
          formTitle={formTitle}
          fields={fields}
          layout={layout}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function PrintPreviewDialog({
  formId,
  formTitle,
  fields,
  layout,
  onClose,
}: {
  formId: string;
  formTitle: string;
  fields: FormField[];
  layout: PrintLayout;
  onClose: () => void;
}) {
  const [submissionId, setSubmissionId] = useState("");
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["print-preview-submissions", formId],
    queryFn: () => listSubmissions({ data: { form_id: formId } }),
  });
  const { data: submissionData, isFetching } = useQuery({
    queryKey: ["print-preview-submission", submissionId],
    queryFn: () => getSubmission({ data: { id: submissionId } }),
    enabled: !!submissionId,
  });
  const size = PAGE_MM[layout.pageSize];
  const submission = submissionData?.submission;
  const values = submissionData
    ? Object.fromEntries(submissionData.values.map((value) => [value.field_id, value.value ?? ""]))
    : {};
  const school = submission?.schools as unknown as { name?: string } | null;
  const ctx: PrintContext | null = submission
    ? {
        fields,
        values,
        publicId: submission.public_id,
        schoolName: school?.name ?? "",
        formTitle,
        createdAt: submission.created_at,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold text-foreground">
            Pré-visualização da impressão
          </h2>
          <p className="text-xs text-muted-foreground">
            Escolha um cadastro para conferir o modelo com os dados reais.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} title="Fechar pré-visualização">
          <X className="h-5 w-5" />
          <span className="sr-only">Fechar</span>
        </Button>
      </div>

      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-xl">
          <Label htmlFor="preview-submission">Cadastro</Label>
          <Select
            id="preview-submission"
            value={submissionId}
            onChange={(event) => setSubmissionId(event.target.value)}
            disabled={isLoading}
          >
            <option value="">
              {isLoading ? "Carregando cadastros..." : "Selecione um cadastro"}
            </option>
            {(submissions ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.public_id}
              </option>
            ))}
          </Select>
          {!isLoading && submissions?.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Este formulário ainda não possui cadastros para visualizar.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/50 p-4 sm:p-8">
        {isFetching ? (
          <div className="flex justify-center py-16">
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        ) : ctx ? (
          <div className="flex flex-col items-center gap-6">
            {layout.pages.map((page, index) => (
              <PreviewPage key={page.id} page={page} pageNumber={index + 1} size={size} ctx={ctx} />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione um cadastro acima para abrir a pré-visualização.
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPage({
  page,
  pageNumber,
  size,
  ctx,
}: {
  page: PrintLayout["pages"][number];
  pageNumber: number;
  size: { w: number; h: number };
  ctx: PrintContext;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const fit = () => {
      const paperWidth = size.w * MM_PX;
      setScale(Math.min(1, Math.max(0.25, wrapper.clientWidth / paperWidth)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [size.w]);

  return (
    <div ref={wrapperRef} className="w-full max-w-[210mm]">
      <p className="mb-2 text-center text-xs text-muted-foreground">Página {pageNumber}</p>
      {overflow && (
        <div className="mb-3 border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          O conteúdo desta página ultrapassa o limite da folha. Reorganize os blocos antes de
          imprimir para evitar dados cortados.
        </div>
      )}
      <div
        className="mx-auto"
        style={{
          width: size.w * MM_PX * scale,
          height: size.h * MM_PX * scale,
        }}
      >
        <DynamicPrintPage
          page={page}
          ctx={ctx}
          width={size.w}
          height={size.h}
          className={`origin-top-left bg-white shadow-lg ${
            overflow ? "outline outline-2 outline-destructive" : ""
          }`}
          style={{
            transform: `scale(${scale})`,
          }}
          onStatusChange={(status) => setOverflow(status.overflow)}
        />
      </div>
    </div>
  );
}

// ---------- Inspetor de propriedades ----------

const rowStyle: CSSProperties = { marginTop: 12 };

function Inspector({
  block,
  fields,
  onChange,
  onDuplicate,
  onRemove,
}: {
  block: PrintBlock;
  fields: FormField[];
  onChange: (patch: Partial<PrintBlock>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground">{BLOCK_LABELS[block.type]}</p>
        <div className="flex gap-1">
          <button
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
          >
            Duplicar
          </button>
          <button className="rounded-md px-2 py-1 text-xs text-destructive" onClick={onRemove}>
            Excluir
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {(["x", "y", "w", "h"] as const).map((k) => (
          <div key={k}>
            <Label className="text-xs">{k.toUpperCase()}</Label>
            <Input
              className="px-2 py-1 text-xs"
              type="number"
              value={block[k]}
              onChange={(e) => onChange({ [k]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Posição e tamanho em milímetros.</p>

      {block.type === "text" && (
        <>
          <div style={rowStyle}>
            <Label>Texto</Label>
            <Textarea
              rows={4}
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </div>
          <TypographyControls block={block} onChange={onChange} />
          <div style={rowStyle}>
            <Label>Cor</Label>
            <input
              type="color"
              className="h-8 w-16 rounded border border-input"
              value={block.color}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </div>
        </>
      )}

      {block.type === "field" && (
        <>
          <div style={rowStyle}>
            <Label>Informação</Label>
            <Select value={block.source} onChange={(e) => onChange({ source: e.target.value })}>
              <optgroup label="Do sistema">
                {SPECIAL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Campos do formulário">
                {fieldOptionsWithAddressParts(fields).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>
          <label className="mt-3 flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--color-primary)]"
              checked={block.showLabel}
              onChange={(e) => onChange({ showLabel: e.target.checked })}
            />
            Mostrar o rótulo antes do valor
          </label>
          {block.showLabel && (
            <div style={rowStyle}>
              <Label>Rótulo personalizado (opcional)</Label>
              <Input
                value={block.labelText}
                onChange={(e) => onChange({ labelText: e.target.value })}
                placeholder="Ex.: Nome do Responsável"
              />
            </div>
          )}
          <TypographyControls block={block} onChange={onChange} />
        </>
      )}

      {block.type === "image" && <ImageControls block={block} onChange={onChange} />}

      {block.type === "box" && (
        <>
          <div style={rowStyle}>
            <Label>Espessura da borda (mm)</Label>
            <Input
              type="number"
              step="0.1"
              value={block.border}
              onChange={(e) => onChange({ border: Number(e.target.value) })}
            />
          </div>
          <div style={rowStyle}>
            <Label>Cantos arredondados (mm)</Label>
            <Input
              type="number"
              step="0.5"
              value={block.radius}
              onChange={(e) => onChange({ radius: Number(e.target.value) })}
            />
          </div>
          <div style={rowStyle}>
            <Label>Preenchimento</Label>
            <Select value={block.fill} onChange={(e) => onChange({ fill: e.target.value })}>
              <option value="">Transparente</option>
              <option value="#d9d9d9">Cinza</option>
              <option value="#f2f2f2">Cinza claro</option>
            </Select>
          </div>
        </>
      )}

      {block.type === "lines" && (
        <div style={rowStyle}>
          <Label>Quantidade de linhas</Label>
          <Input
            type="number"
            min={1}
            value={block.count}
            onChange={(e) => onChange({ count: Number(e.target.value) })}
          />
        </div>
      )}

      {block.type === "signature" && (
        <>
          <div style={rowStyle}>
            <Label>Legenda</Label>
            <Input value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} />
          </div>
          <div style={rowStyle}>
            <Label>Tamanho da letra (pt)</Label>
            <Input
              type="number"
              value={block.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {block.type === "children" && (
        <>
          <div style={rowStyle}>
            <Label>Campo "N Filhos"</Label>
            <Select value={block.fieldId} onChange={(e) => onChange({ fieldId: e.target.value })}>
              <option value="">Automático</option>
              {fields
                .filter((f) => f.type === "children")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
            </Select>
          </div>
          <div style={rowStyle}>
            <Label>Formato</Label>
            <Select
              value={block.mode}
              onChange={(e) => onChange({ mode: e.target.value as "list" | "table" })}
            >
              <option value="list">Lista</option>
              <option value="table">Tabela</option>
            </Select>
          </div>
          <div style={rowStyle}>
            <Label>Tamanho da letra (pt)</Label>
            <Input
              type="number"
              value={block.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {block.type === "table" && (
        <TableControls block={block} fields={fields} onChange={onChange} />
      )}
    </div>
  );
}

function TypographyControls({
  block,
  onChange,
}: {
  block: Extract<PrintBlock, { fontSize: number; align: string }>;
  onChange: (patch: Partial<PrintBlock>) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div>
        <Label className="text-xs">Letra (pt)</Label>
        <Input
          className="px-2 py-1 text-xs"
          type="number"
          value={block.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-xs">Alinhamento</Label>
        <Select
          className="px-2 py-1 text-xs"
          value={block.align}
          onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" })}
        >
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
          <option value="justify">Justificado</option>
        </Select>
      </div>
      <div className="col-span-2 flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="accent-[var(--color-primary)]"
            checked={"bold" in block ? block.bold : false}
            onChange={(e) => onChange({ bold: e.target.checked })}
          />
          Negrito
        </label>
        {"italic" in block && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-[var(--color-primary)]"
              checked={block.italic}
              onChange={(e) => onChange({ italic: e.target.checked })}
            />
            Itálico
          </label>
        )}
        {"underline" in block && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-[var(--color-primary)]"
              checked={block.underline}
              onChange={(e) => onChange({ underline: e.target.checked })}
            />
            Sublinhado
          </label>
        )}
      </div>
    </div>
  );
}

function ImageControls({
  block,
  onChange,
}: {
  block: Extract<PrintBlock, { type: "image" }>;
  onChange: (patch: Partial<PrintBlock>) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const supabase = await getSupabase();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${uid()}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("print-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("print-assets").getPublicUrl(path);
      onChange({ url: data.publicUrl });
      toast.success("Imagem enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div style={rowStyle}>
        <Label>Imagem</Label>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {uploading && <p className="mt-1 text-xs text-muted-foreground">Enviando...</p>}
        {block.url && (
          <img
            src={block.url}
            alt=""
            className="mt-2 max-h-20 rounded border border-border object-contain"
          />
        )}
      </div>
      <div style={rowStyle}>
        <Label>Ajuste</Label>
        <Select
          value={block.fit}
          onChange={(e) => onChange({ fit: e.target.value as "contain" | "cover" })}
        >
          <option value="contain">Caber inteira</option>
          <option value="cover">Preencher a área</option>
        </Select>
      </div>
    </>
  );
}

function TableControls({
  block,
  fields,
  onChange,
}: {
  block: TableBlock;
  fields: FormField[];
  onChange: (patch: Partial<PrintBlock>) => void;
}) {
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const current = block.rows[sel.r]?.[sel.c];

  function setRows(rows: TableBlock["rows"]) {
    onChange({ rows } as Partial<PrintBlock>);
  }

  function setCell(patch: Partial<(typeof block.rows)[0][0]>) {
    setRows(
      block.rows.map((row, ri) =>
        ri === sel.r ? row.map((c, ci) => (ci === sel.c ? { ...c, ...patch } : c)) : row,
      ),
    );
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Colunas</Label>
          <Input
            className="px-2 py-1 text-xs"
            type="number"
            min={1}
            max={8}
            value={block.cols.length}
            onChange={(e) => {
              const n = Math.max(1, Math.min(8, Number(e.target.value)));
              const cols = Array.from({ length: n }, (_, i) => block.cols[i] ?? 1);
              const rows = block.rows.map((row) =>
                Array.from({ length: n }, (_, i) => row[i] ?? cell("")),
              );
              onChange({ cols, rows } as Partial<PrintBlock>);
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Linhas</Label>
          <Input
            className="px-2 py-1 text-xs"
            type="number"
            min={1}
            max={30}
            value={block.rows.length}
            onChange={(e) => {
              const n = Math.max(1, Math.min(30, Number(e.target.value)));
              const rows = Array.from(
                { length: n },
                (_, i) =>
                  block.rows[i] ?? Array.from({ length: block.cols.length }, () => cell("")),
              );
              const rowHeights = Array.from({ length: n }, (_, i) => block.rowHeights[i] ?? 1);
              onChange({ rows, rowHeights } as Partial<PrintBlock>);
            }}
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--color-primary)]"
          checked={block.header}
          onChange={(e) => onChange({ header: e.target.checked } as Partial<PrintBlock>)}
        />
        Primeira linha é cabeçalho
      </label>

      <div style={rowStyle}>
        <Label className="text-xs">Larguras das colunas (pesos)</Label>
        <div className="flex flex-wrap gap-1">
          {block.cols.map((c, i) => (
            <Input
              key={i}
              className="w-14 px-2 py-1 text-xs"
              type="number"
              min={1}
              value={c}
              onChange={(e) => {
                const cols = [...block.cols];
                cols[i] = Math.max(1, Number(e.target.value));
                onChange({ cols } as Partial<PrintBlock>);
              }}
            />
          ))}
        </div>
      </div>

      <div style={rowStyle}>
        <Label className="text-xs">Alturas das linhas (pesos)</Label>
        <div className="flex flex-wrap gap-1">
          {block.rows.map((_, i) => (
            <Input
              key={i}
              className="w-14 px-2 py-1 text-xs"
              type="number"
              min={1}
              value={block.rowHeights[i] ?? 1}
              onChange={(e) => {
                const rowHeights = block.rows.map((_, j) => block.rowHeights[j] ?? 1);
                rowHeights[i] = Math.max(1, Number(e.target.value));
                onChange({ rowHeights } as Partial<PrintBlock>);
              }}
            />
          ))}
        </div>
      </div>

      <div style={rowStyle}>
        <Label className="text-xs">Célula</Label>
        <div className="flex gap-2">
          <Select
            className="px-2 py-1 text-xs"
            value={String(sel.r)}
            onChange={(e) => setSel({ ...sel, r: Number(e.target.value) })}
          >
            {block.rows.map((_, i) => (
              <option key={i} value={i}>
                Linha {i + 1}
              </option>
            ))}
          </Select>
          <Select
            className="px-2 py-1 text-xs"
            value={String(sel.c)}
            onChange={(e) => setSel({ ...sel, c: Number(e.target.value) })}
          >
            {block.cols.map((_, i) => (
              <option key={i} value={i}>
                Coluna {i + 1}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {current && (
        <>
          <div style={rowStyle}>
            <Label className="text-xs">Conteúdo da célula</Label>
            <Select
              className="px-2 py-1 text-xs"
              value={current.source}
              onChange={(e) => setCell({ source: e.target.value })}
            >
              <option value="">Texto fixo / em branco</option>
              <optgroup label="Do sistema">
                {SPECIAL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Campos do formulário">
                {fieldOptionsWithAddressParts(fields).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>
          {!current.source && (
            <div style={rowStyle}>
              <Textarea
                rows={2}
                value={current.text}
                onChange={(e) => setCell({ text: e.target.value })}
                placeholder="Texto da célula (deixe vazio para preencher à mão)"
              />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-[var(--color-primary)]"
                checked={current.bold}
                onChange={(e) => setCell({ bold: e.target.checked })}
              />
              Negrito
            </label>
            <Select
              className="w-32 px-2 py-1 text-xs"
              value={current.align}
              onChange={(e) => setCell({ align: e.target.value as "left" | "center" })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </Select>
          </div>
        </>
      )}

      <div style={rowStyle}>
        <Label className="text-xs">Tamanho da letra (pt)</Label>
        <Input
          className="px-2 py-1 text-xs"
          type="number"
          value={block.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) } as Partial<PrintBlock>)}
        />
      </div>
    </>
  );
}

export function pageSizeLabel(p: PageSizeName) {
  return p;
}
