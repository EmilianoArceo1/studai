import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Anchor } from "../../domain/entities/Anchor";

type Rect = { x: number; y: number; width: number; height: number };

interface Props {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  highlight?: boolean;
  anchors?: Anchor[];
  onHighlight?: (payload: {
    quote: string;
    pageNumber: number;
    rects: Rect[];
  }) => void;
}

function getSelectionRects(range: Range, container: HTMLElement): Rect[] {
  const containerRect = container.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .map((r) => ({
      x: r.left - containerRect.left,
      y: r.top - containerRect.top,
      width: r.width,
      height: r.height,
    }))
    .filter((r) => r.width > 0 && r.height > 0);
}

export function PdfPage({
  pdf,
  pageNumber,
  highlight = false,
  anchors = [],
  onHighlight,
}: Props) {
  const visualScale = 1.2;
  const renderScale = 3;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(
    null
  );

  const lastSelectionRef = useRef<{
    quote: string;
    pageNumber: number;
    rects: Rect[];
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(
    null
  );

  // ───────── Render PDF + TextLayer ─────────
  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const render = async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: visualScale });

      setPageSize({ w: viewport.width, h: viewport.height });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      const qualityMultiplier = renderScale / visualScale;

      canvas.width = viewport.width * dpr * qualityMultiplier;
      canvas.height = viewport.height * dpr * qualityMultiplier;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(
        dpr * qualityMultiplier,
        0,
        0,
        dpr * qualityMultiplier,
        0,
        0
      );

      renderTask = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      });

      await renderTask.promise;
      if (cancelled) return;

      const textContent = await page.getTextContent();
      const textLayer = textLayerRef.current!;
      textLayer.innerHTML = "";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      textContent.items.forEach((item: any) => {
        const span = document.createElement("span");
        span.textContent = item.str;

        const [a, b, , , e, f] = pdfjsLib.Util.transform(
          viewport.transform,
          item.transform
        );

        const fontHeight = Math.sqrt(a * a + b * b);

        span.style.position = "absolute";
        span.style.left = `${e}px`;
        span.style.top = `${f - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.whiteSpace = "pre";

        textLayer.appendChild(span);
      });
    };

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  // ───────── Captura selección ─────────
  const handleMouseUp = () => {
    setContextMenu(null);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    if (
      !textLayer.contains(range.startContainer) ||
      !textLayer.contains(range.endContainer)
    ) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) return;

    const rawRects = getSelectionRects(range, textLayer);
    if (!pageSize || rawRects.length === 0) return;

    // ✅ NORMALIZACIÓN
    const rects = rawRects.map((r) => ({
      x: r.x / pageSize.w,
      y: r.y / pageSize.h,
      width: r.width / pageSize.w,
      height: r.height / pageSize.h,
    }));

    lastSelectionRef.current = { quote: text, pageNumber, rects };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) e.preventDefault();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const last = lastSelectionRef.current;
    if (!last || last.pageNumber !== pageNumber) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const anchorsThisPage = anchors.filter((a) => a.pageNumber === pageNumber);

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 24,
        width: pageSize ? `${pageSize.w}px` : "fit-content",
        height: pageSize ? `${pageSize.h}px` : "auto",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <canvas ref={canvasRef} style={{ zIndex: 1, display: "block" }} />

      {pageSize && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {anchorsThisPage.flatMap((a) =>
            (a.rects ?? []).map((r, i) => (
              <div
                key={`${a.anchorId}-${i}`}
                style={{
                  position: "absolute",
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.width * 100}%`,
                  height: `${r.height * 100}%`,
                  background: "rgba(253, 224, 71, 0.45)",
                }}
              />
            ))
          )}
        </div>
      )}

      {pageSize && (
        <div
          ref={textLayerRef}
          style={{
            position: "absolute",
            inset: 0,
            userSelect: "text",
            color: "rgba(0,0,0,0.01)",
            zIndex: 3,
          }}
        />
      )}

      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#020617",
            color: "white",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: 6,
            zIndex: 9999,
            fontSize: 13,
            minWidth: 140,
          }}
        >
          <div
            style={{ padding: "6px 10px", cursor: "pointer" }}
            onClick={() => {
              const last = lastSelectionRef.current;
              if (!last) return;

              onHighlight?.(last);
              setContextMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            Subrayar
          </div>
        </div>
      )}
    </div>
  );
}
