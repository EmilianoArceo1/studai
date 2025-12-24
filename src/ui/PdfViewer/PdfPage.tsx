import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Anchor } from "../../domain/entities/Anchor";

type Rect = { x: number; y: number; width: number; height: number };

interface Props {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  anchors?: Anchor[];

  commentedAnchorIds?: Set<string>;

  onHighlight?: (payload: { quote: string; pageNumber: number; rects: Rect[] }) => void;

  onRequestComment?: (payload: {
    quote: string;
    pageNumber: number;
    rects: Rect[];
    clientX: number;
    clientY: number;
  }) => void;

  onOpenComment?: (payload: {
    anchor: Anchor;
    clientX: number;
    clientY: number;
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
  anchors = [],
  commentedAnchorIds = new Set(),
  onHighlight,
  onRequestComment,
  onOpenComment,
}: Props) {
  const visualScale = 1.2;
  const renderScale = 3;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  const lastSelectionRef = useRef<{
    quote: string;
    pageNumber: number;
    rects: Rect[];
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const textLayerTaskRef = useRef<any>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: visualScale });
      setPageSize({ w: viewport.width, h: viewport.height });

      // Canvas
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      const qualityMultiplier = renderScale / visualScale;
      canvas.width = viewport.width * dpr * qualityMultiplier;
      canvas.height = viewport.height * dpr * qualityMultiplier;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr * qualityMultiplier, 0, 0, dpr * qualityMultiplier, 0, 0);

      renderTaskRef.current?.cancel?.();
      const renderTask = page.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      if (cancelled) return;

      // TextLayer (pdf.js oficial)
      const textLayer = textLayerRef.current!;
      textLayer.innerHTML = "";
      textLayer.className = "textLayer";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      const textContent = await page.getTextContent();

      try {
        textLayerTaskRef.current?.cancel?.();
      } catch {}

      let rendered = false;

      try {
        const viewerMod: any = await import("pdfjs-dist/web/pdf_viewer");
        const renderTextLayer = viewerMod?.renderTextLayer;
        if (typeof renderTextLayer === "function") {
          const task = renderTextLayer({ textContent, container: textLayer, viewport, textDivs: [] });
          textLayerTaskRef.current = task;
          if (task?.promise) await task.promise;
          else if (task?.then) await task;
          rendered = true;
        }
      } catch {}

      if (!rendered) {
        const anyPdf: any = pdfjsLib as any;
        if (typeof anyPdf.renderTextLayer === "function") {
          const task = anyPdf.renderTextLayer({ textContent, container: textLayer, viewport, textDivs: [] });
          textLayerTaskRef.current = task;
          if (task?.promise) await task.promise;
          else if (task?.then) await task;
          rendered = true;
        }
      }

      if (!rendered) {
        // fallback simple
        for (const item of textContent.items as any[]) {
          const span = document.createElement("span");
          span.textContent = item.str;
          const [a, b, , , e, f] = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.hypot(a, b);
          span.style.position = "absolute";
          span.style.left = `${e}px`;
          span.style.top = `${f - fontHeight}px`;
          span.style.fontSize = `${fontHeight}px`;
          span.style.whiteSpace = "pre";
          span.style.transformOrigin = "0 0";
          span.style.transform = "scaleX(1)";
          textLayer.appendChild(span);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel?.();
      } catch {}
      try {
        textLayerTaskRef.current?.cancel?.();
      } catch {}
    };
  }, [pdf, pageNumber]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    if (!textLayer.contains(range.startContainer) || !textLayer.contains(range.endContainer)) return;

    const text = selection.toString().trim();
    if (!text || !pageSize) return;

    const rawRects = getSelectionRects(range, textLayer);
    if (rawRects.length === 0) return;

    const rects = rawRects.map((r) => ({
      x: r.x / pageSize.w,
      y: r.y / pageSize.h,
      width: r.width / pageSize.w,
      height: r.height / pageSize.h,
    }));

    lastSelectionRef.current = { quote: text, pageNumber, rects };
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const last = lastSelectionRef.current;
    if (!last) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const anchorsThisPage = useMemo(
    () => anchors.filter((a) => a.pageNumber === pageNumber),
    [anchors, pageNumber]
  );

  const allRects: Rect[] = useMemo(() => {
    return anchorsThisPage.flatMap((a) => a.rects ?? []);
  }, [anchorsThisPage]);

  return (
    <div
      style={{
        position: "relative",
        width: pageSize ? `${pageSize.w}px` : "fit-content",
        marginBottom: 24,
      }}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <style>{`
        .textLayer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          line-height: 1;
          user-select: text;
          -webkit-user-select: text;
          z-index: 2;
        }
        .textLayer span {
          color: transparent;
          position: absolute;
          transform-origin: 0 0;
          white-space: pre;
          cursor: text;
        }
        .textLayer ::selection {
          background: rgba(59,130,246,.35);
        }
      `}</style>

<canvas
  ref={canvasRef}
  style={{
    display: "block",
    position: "relative",
    zIndex: 1,
    pointerEvents: "none", // 🔑 CLAVE
  }}
/>
<div
  ref={textLayerRef}
  className="textLayer"
  style={{
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "auto", // 🔑 OBLIGATORIO
  }}
/>

      {/* Highlights */}
      {pageSize && (
        <div
           style={{
    position: "absolute",
    inset: 0,
    zIndex: 3,
    pointerEvents: "none", // 🔑 FUNDAMENTAL
  }}
        >
          {allRects.map((r, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
                background: "rgba(253,224,71,0.45)",
              }}
            />
          ))}
        </div>
      )}

      {/* Comment icons (pointerEvents ON) */}
      {pageSize && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          {anchorsThisPage
            .filter((a) => commentedAnchorIds.has(a.anchorId))
            .map((a) => {
              const r = a.rects?.[0];
              if (!r) return null;

              return (
                <button
                  key={a.anchorId}
                  title="Abrir comentario"
                  style={{
                    position: "absolute",
                    left: `${Math.max(0, r.x * 100)}%`,
                    top: `${Math.max(0, r.y * 100)}%`,
                    transform: "translate(-10px, -18px)",
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(2,6,23,0.9)",
                    color: "white",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenComment?.({ anchor: a, clientX: e.clientX, clientY: e.clientY });
                  }}
                >
                  💬
                </button>
              );
            })}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#020617",
            border: "1px solid #334155",
            borderRadius: 10,
            color: "white",
            fontSize: 13,
            zIndex: 99999,
            minWidth: 170,
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            overflow: "hidden",
          }}
        >
          <div
            style={{ padding: "10px 12px", cursor: "pointer" }}
            onClick={() => {
              const last = lastSelectionRef.current;
              if (!last) return;
              onHighlight?.(last);
              setContextMenu(null);
              requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
            }}
          >
            Subrayar
          </div>

          <div
            style={{ padding: "10px 12px", cursor: "pointer" }}
            onClick={() => {
              const last = lastSelectionRef.current;
              if (!last) return;

              onRequestComment?.({
                quote: last.quote,
                pageNumber: last.pageNumber,
                rects: last.rects,
                clientX: contextMenu.x,
                clientY: contextMenu.y,
              });

              setContextMenu(null);
              requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
            }}
          >
            Comentar
          </div>
        </div>
      )}
    </div>
  );
}
