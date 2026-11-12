import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from "react";
import { BlockView } from "@/components/print/BlockView";
import { MM_PX, type PrintBlock, type PrintContext, type PrintPage } from "@/lib/ext/print-layout";

export type PositionedPrintBlock = {
  block: PrintBlock;
  y: number;
  h: number;
  dynamic: boolean;
};

function isDynamic(block: PrintBlock) {
  return block.type === "field" || block.type === "table" || block.type === "children";
}

function overlapsHorizontally(a: PrintBlock, b: PrintBlock) {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

export function useDynamicPrintLayout(
  page: PrintPage | undefined,
  ctx: PrintContext,
  pageHeight: number,
) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [measured, setMeasured] = useState(false);

  const register = useCallback(
    (id: string): RefCallback<HTMLDivElement> =>
      (node) => {
        if (node) nodes.current.set(id, node);
        else nodes.current.delete(id);
      },
    [],
  );

  useLayoutEffect(() => {
    if (!page) return;
    const next: Record<string, number> = {};
    page.blocks.forEach((block) => {
      if (!isDynamic(block)) return;
      const node = nodes.current.get(block.id);
      if (!node) return;
      next[block.id] = Math.max(block.h, node.scrollHeight / MM_PX);
    });
    setHeights((current) => {
      const changed =
        Object.keys(next).length !== Object.keys(current).length ||
        Object.entries(next).some(([id, height]) => Math.abs((current[id] ?? 0) - height) > 0.15);
      return changed ? next : current;
    });
    setMeasured(true);
  }, [ctx, page]);

  const blocks = useMemo<PositionedPrintBlock[]>(() => {
    if (!page) return [];
    const ordered = [...page.blocks].sort((a, b) => a.y - b.y || a.x - b.x);
    const placed: PositionedPrintBlock[] = [];

    ordered.forEach((block) => {
      const dynamic = isDynamic(block);
      const h = dynamic ? Math.max(block.h, heights[block.id] ?? block.h) : block.h;
      let y = block.y;

      placed.forEach((previous) => {
        const originalBottom = previous.block.y + previous.block.h;
        if (block.y >= originalBottom && overlapsHorizontally(block, previous.block)) {
          const originalGap = block.y - originalBottom;
          y = Math.max(y, previous.y + previous.h + originalGap);
        }
      });

      placed.push({ block, y, h, dynamic });
    });

    return placed;
  }, [heights, page]);

  const overflow = blocks.some(({ y, h }) => y + h > pageHeight + 0.1);
  return { blocks, measured, overflow, register };
}

export function DynamicPrintPage({
  page,
  ctx,
  width,
  height,
  preview = false,
  className,
  style,
  onStatusChange,
}: {
  page: PrintPage;
  ctx: PrintContext;
  width: number;
  height: number;
  preview?: boolean;
  className?: string;
  style?: CSSProperties;
  onStatusChange?: (status: { ready: boolean; overflow: boolean }) => void;
}) {
  const layout = useDynamicPrintLayout(page, ctx, height);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  // Só consideramos a página pronta quando as imagens terminam de baixar —
  // sem isso, a primeira impressão sai sem a logo.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const images = Array.from(root.querySelectorAll("img"));
    const pending = images.filter((img) => !img.complete);
    if (pending.length === 0) {
      setImagesReady(true);
      return;
    }
    setImagesReady(false);
    let left = pending.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setImagesReady(true);
    };
    const settle = () => {
      left -= 1;
      if (left <= 0) finish();
    };
    pending.forEach((img) => {
      img.addEventListener("load", settle);
      img.addEventListener("error", settle);
    });
    // Rede lenta ou imagem quebrada não pode travar a impressão.
    const timer = window.setTimeout(finish, 5000);
    return () => {
      window.clearTimeout(timer);
      pending.forEach((img) => {
        img.removeEventListener("load", settle);
        img.removeEventListener("error", settle);
      });
    };
  }, [layout.blocks]);

  useLayoutEffect(() => {
    onStatusChange?.({ ready: layout.measured && imagesReady, overflow: layout.overflow });
  }, [layout.measured, layout.overflow, imagesReady, onStatusChange]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        width: `${width}mm`,
        height: `${height}mm`,
        color: "#000",
        overflow: "hidden",
        ...style,
      }}
    >
      {layout.blocks.map(({ block, y, dynamic }) => (
        <div
          key={block.id}
          ref={registerDynamicRef(layout.register, block.id, dynamic)}
          style={{
            position: "absolute",
            left: `${block.x}mm`,
            top: `${y}mm`,
            width: `${block.w}mm`,
            minHeight: `${block.h}mm`,
            height: dynamic ? "auto" : `${block.h}mm`,
            overflow: dynamic ? "visible" : "hidden",
          }}
        >
          <BlockView block={block} ctx={ctx} preview={preview} />
        </div>
      ))}
    </div>
  );
}

function registerDynamicRef(
  register: (id: string) => RefCallback<HTMLDivElement>,
  id: string,
  dynamic: boolean,
) {
  return dynamic ? register(id) : undefined;
}
