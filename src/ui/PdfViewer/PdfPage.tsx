import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Anchor } from "../../domain/entities/Anchor";

type Rect = { x: number; y: number; width: number; height: number };

interface Props {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  anchors?: Anchor[];
  commentedAnchorIds?: Set<string>;
  highlightColorByAnchorId?: Record<string, string>;
  onHighlight?: (payload: {
    quote: string;
    pageNumber: number;
    rects: Rect[];
    color: string;
  }) => void;
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

const DEFAULT_HIGHLIGHT = "#fde047";
const HIGHLIGHT_COLORS = [
  "#93c5fd", // blue
  "#86efac", // green
  "#fca5a5", // red
  "#e9d5ff", // purple
  "#fde047", // yellow
];

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
  commentedAnchorIds = new Set<string>(),
  highlightColorByAnchorId = {},
  onHighlight,
  onRequestComment,
  onOpenComment,
}: Props) {
  const [scale, setScale] = useState(1);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number } | null>(null);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef<{
    quote: string;
    pageNumber: number;
    rects: Rect[];
  } | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const textLayerTaskRef = useRef<any>(null);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setColorMenu(null);
      }
    };

    const handleClickOutside = () => {
      setContextMenu(null);
      setColorMenu(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calculate scale based on container width
  useEffect(() => {
    const el = pageContainerRef.current;
    if (!el) return;

    const calculateScale = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1 });
        const containerWidth = el.clientWidth;
        
        if (containerWidth > 0) {
          const nextScale = containerWidth / unscaled.width;
          setScale(nextScale);
        }
      } catch (error) {
        console.error("Error calculating scale:", error);
      }
    };

    const observer = new ResizeObserver(calculateScale);
    observer.observe(el);
    
    // Initial calculation
    calculateScale();

    return () => observer.disconnect();
  }, [pdf, pageNumber]);

  // Render PDF
  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!canvasRef.current || !textLayerRef.current) return;

      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        setPageSize({ w: viewport.width, h: viewport.height });

        // Render canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("Failed to get canvas context");
          return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Cancel previous render task
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (error) {
            // Task might already be finished
          }
        }

        // Render page
        const task = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = task;

        await task.promise;
        if (isCancelled) return;

        // Render text layer
        const textLayer = textLayerRef.current;
        textLayer.innerHTML = "";
        textLayer.className = "textLayer";
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();

        // Try to use pdf.js official text layer renderer
        try {
          const pdfViewer = await import("pdfjs-dist/web/pdf_viewer");
          const { renderTextLayer } = pdfViewer;
          
          if (renderTaskRef.current) {
            textLayerTaskRef.current = renderTextLayer({
              textContent,
              container: textLayer,
              viewport,
              textDivs: [],
            });
            
            if (textLayerTaskRef.current?.promise) {
              await textLayerTaskRef.current.promise;
            }
          }
        } catch (error) {
          console.warn("Using fallback text layer:", error);
          // Fallback: create spans manually
          for (const item of textContent.items as any[]) {
            const span = document.createElement("span");
            span.textContent = item.str;
            
            const [a, b, , , e, f] = pdfjsLib.Util.transform(
              viewport.transform,
              item.transform
            );
            const fontHeight = Math.hypot(a, b);
            
            span.style.position = "absolute";
            span.style.left = `${e}px`;
            span.style.top = `${f - fontHeight}px`;
            span.style.fontSize = `${fontHeight}px`;
            span.style.lineHeight = "1";
            span.style.whiteSpace = "pre";
            span.style.color = "transparent";
            span.style.transform = "none";
            
            textLayer.appendChild(span);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error rendering PDF page:", error);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (error) {
          // Ignore cancellation errors
        }
      }
      if (textLayerTaskRef.current) {
        try {
          textLayerTaskRef.current.cancel?.();
        } catch (error) {
          // Ignore cancellation errors
        }
      }
    };
  }, [pdf, pageNumber, scale]);

  // Handle text selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !textLayerRef.current) return;

    const range = selection.getRangeAt(0);
    const textLayer = textLayerRef.current;

    // Ensure selection is within text layer
    if (
      !textLayer.contains(range.startContainer) ||
      !textLayer.contains(range.endContainer)
    ) {
      return;
    }

    const text = selection.toString().trim();
    if (!text || !pageSize) return;

    const rectsPx = getSelectionRects(range, textLayer);
    if (rectsPx.length === 0) return;

    // Normalize rects relative to page size
    const rects = rectsPx.map((r) => ({
      x: r.x / pageSize.w,
      y: r.y / pageSize.h,
      width: r.width / pageSize.w,
      height: r.height / pageSize.h,
    }));

    lastSelectionRef.current = { 
      quote: text, 
      pageNumber, 
      rects 
    };
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!lastSelectionRef.current) return;

    e.stopPropagation();
    setColorMenu(null);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Filter anchors for this page
  const anchorsThisPage = useMemo(
    () => anchors.filter((a) => a.pageNumber === pageNumber),
    [anchors, pageNumber]
  );

  // Get highlight color for anchor
  const getAnchorColor = (anchorId: string): string => {
    return highlightColorByAnchorId[anchorId] || DEFAULT_HIGHLIGHT;
  };

  return (
    <div
      ref={pageContainerRef}
      style={{
        position: "relative",
        width: "100%",
        marginBottom: "24px",
      }}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <style>{`
        .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          color: transparent;
          pointer-events: auto;
          line-height: 1;
          overflow: hidden;
        }
        
        .textLayer span {
          cursor: text;
          position: absolute;
          white-space: pre;
          transform: none !important;
        }
        
        .textLayer ::selection {
          background-color: rgba(59, 130, 246, 0.35);
        }
        
        .textLayer ::-moz-selection {
          background-color: rgba(59, 130, 246, 0.35);
        }
        
        .menuStop {
          pointer-events: auto;
        }
      `}</style>

      {/* Canvas for PDF rendering */}
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Highlights overlay */}
      {pageSize && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {anchorsThisPage.flatMap((anchor) =>
            (anchor.rects ?? []).map((rect, index) => {
              const color = getAnchorColor(anchor.anchorId);
              return (
                <div
                  key={`${anchor.anchorId}-${index}`}
                  style={{
                    position: "absolute",
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                    backgroundColor: color,
                    opacity: 0.35,
                    borderRadius: "2px",
                    border: `1px solid ${color}33`,
                    boxSizing: "border-box",
                  }}
                />
              );
            })
          )}
        </div>
      )}

      {/* Text layer for selection */}
      <div ref={textLayerRef} className="textLayer" />

      {/* Comment icons for annotated anchors */}
      {pageSize &&
        anchorsThisPage
          .filter((anchor) => commentedAnchorIds.has(anchor.anchorId))
          .map((anchor) => {
            const rect = anchor.rects?.[0];
            if (!rect) return null;

            return (
              <button
                key={anchor.anchorId}
                type="button"
                title="Abrir comentario"
                aria-label={`Abrir comentario en ${anchor.quote?.substring(0, 30)}...`}
                style={{
                  position: "absolute",
                  zIndex: 3,
                  left: `${Math.max(0, rect.x * 100)}%`,
                  top: `${Math.max(0, rect.y * 100)}%`,
                  transform: "translate(-8px, -14px)",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  backgroundColor: "rgba(2, 6, 23, 0.85)",
                  backdropFilter: "blur(4px)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "10px",
                  lineHeight: 1,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translate(-8px, -14px) scale(1.1)";
                  e.currentTarget.style.backgroundColor = "rgba(2, 6, 23, 0.95)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translate(-8px, -14px) scale(1)";
                  e.currentTarget.style.backgroundColor = "rgba(2, 6, 23, 0.85)";
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenComment?.({
                    anchor,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                }}
              >
                💬
              </button>
            );
          })}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="menuStop"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: "#020617",
            border: "1px solid #334155",
            borderRadius: "10px",
            color: "white",
            fontSize: "13px",
            zIndex: 99999,
            minWidth: "170px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
            overflow: "hidden",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              textAlign: "left",
              backgroundColor: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(51, 65, 85, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setContextMenu(null);
              setColorMenu({ x: contextMenu.x, y: contextMenu.y });
            }}
          >
            Subrayar
          </button>

          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px 12px",
              textAlign: "left",
              backgroundColor: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(51, 65, 85, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const selection = lastSelectionRef.current;
              if (!selection) return;

              onRequestComment?.({
                quote: selection.quote,
                pageNumber: selection.pageNumber,
                rects: selection.rects,
                clientX: contextMenu.x,
                clientY: contextMenu.y,
              });

              setContextMenu(null);
              requestAnimationFrame(() => {
                window.getSelection()?.removeAllRanges();
              });
            }}
          >
            Comentar
          </button>
        </div>
      )}

      {/* Color picker menu */}
      {colorMenu && (
        <div
          className="menuStop"
          style={{
            position: "fixed",
            top: colorMenu.y,
            left: colorMenu.x,
            display: "flex",
            gap: "8px",
            padding: "10px",
            backgroundColor: "#020617",
            border: "1px solid #334155",
            borderRadius: "12px",
            zIndex: 100000,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Color de resaltado: ${color}`}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: color,
                border: `1px solid rgba(255, 255, 255, 0.2)`,
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const selection = lastSelectionRef.current;
                if (!selection) return;

                onHighlight?.({
                  quote: selection.quote,
                  pageNumber: selection.pageNumber,
                  rects: selection.rects,
                  color,
                });

                setColorMenu(null);
                requestAnimationFrame(() => {
                  window.getSelection()?.removeAllRanges();
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}