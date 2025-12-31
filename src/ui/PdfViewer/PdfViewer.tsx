// components/pdf/PdfViewer.tsx
import "./pdfWorker";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PdfPage } from "./PdfPage";
import { useAppStore } from "../../app/store";
import type { Anchor } from "../../domain/entities/Anchor";
import type { Idea } from "../../domain/entities/Idea";
import type { RelationType } from "../../domain/entities/Relation";
import { IdeaOrigin } from "../../domain/enums/IdeaOrigin";
import { IdeaStatus } from "../../domain/enums/IdeaStatus";
import { IdeaType } from "../../domain/enums/IdeaType";

interface Props {
  file: string;
  onRequestComment?: (anchor: Anchor) => void;
}

export interface PdfViewerHandle {
  goToAnchor: (anchor: Anchor) => void;
}

type CommentDraft = {
  mode: "create" | "edit";
  anchor: Anchor;
  x: number;
  y: number;
  ideaId?: string;
  text: string;
  ideaType: IdeaType;
  relateToIdeaId: string;
  relationType: RelationType | "";
  relationDirection: "THIS_TO_TARGET" | "TARGET_TO_THIS";
  justification: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizePanelPos(x: number, y: number, w = 360, h = 420) {
  const pad = 10;
  const maxX = window.innerWidth - w - pad;
  const maxY = window.innerHeight - h - pad;

  const looksBad =
    x < pad || y < pad || x > maxX || y > maxY || y > window.innerHeight * 0.75;

  if (looksBad) {
    return {
      x: clamp(Math.round((window.innerWidth - w) / 2), pad, maxX),
      y: clamp(Math.round((window.innerHeight - h) / 2), pad, maxY),
    };
  }

  return {
    x: clamp(x, pad, maxX),
    y: clamp(y, pad, maxY),
  };
}

export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { file, onRequestComment },
  ref
) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [viewerWidth, setViewerWidth] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const commentBoxRef = useRef<HTMLDivElement>(null);
  
  // Usamos refs para el drag en lugar de estado
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Zustand state
  const anchors = useAppStore((s) => s.anchors);
  const ideas = useAppStore((s) => s.ideas);
  const relations = useAppStore((s) => s.relations);
  const highlights = useAppStore((s) => s.highlights);

  const loadAnchors = useAppStore((s) => s.loadAnchors);
  const addAnchor = useAppStore((s) => s.addAnchor);
  const addHighlight = useAppStore((s) => s.addHighlight);
  const addIdea = useAppStore((s) => s.addIdea);
  const updateIdea = useAppStore((s) => s.updateIdea);
  const addRelation = useAppStore((s) => s.addRelation);

  // Derived data - usar useMemo solo cuando sea necesario
  const highlightColorByAnchorId = useMemo(() => {
    const map: Record<string, string> = {};
    highlights.forEach((h) => {
      map[h.anchorId] = h.color;
    });
    return map;
  }, [highlights]);

  const anchorsForFile = useMemo(
    () => anchors.filter((a) => a.sourceId === file),
    [anchors, file]
  );

  const commentIdeas = useMemo(
    () =>
      ideas.filter(
        (i) => i.origin === IdeaOrigin.FROM_COMMENT && i.sourceId === file
      ),
    [ideas, file]
  );

  const ideaByAnchorId = useMemo(() => {
    const map = new Map<string, Idea>();
    commentIdeas.forEach((i) => {
      if (i.anchorId) map.set(i.anchorId, i);
    });
    return map;
  }, [commentIdeas]);

  const commentedAnchorIds = useMemo(
    () => new Set(commentIdeas.map((i) => i.anchorId).filter(Boolean)),
    [commentIdeas]
  );

  const relationCandidates = useMemo(() => {
    return ideas
      .filter((i) => i.projectId === "demo-project")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [ideas]);

  // Effects
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const width = el.clientWidth - 48;
      setViewerWidth(Math.max(width, 0));
    };

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    updateWidth();

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        const loadedPdf = await pdfjsLib.getDocument(file).promise;
        if (!isCancelled) {
          setPdf(loadedPdf);
        }
      } catch (error) {
        console.error("Error loading PDF:", error);
        if (!isCancelled) setPdf(null);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  useEffect(() => {
    loadAnchors();
  }, [file, loadAnchors]);

  // Navigation
  const goToAnchor = useCallback((anchor: Anchor) => {
    const container = containerRef.current;
    if (!container) return;

    const pageEl = pageRefs.current.get(anchor.pageNumber);
    if (!pageEl) return;

    const rect = anchor.rects?.[0];
    if (!rect) return;

    const pageTop = pageEl.offsetTop;
    const pageHeight = pageEl.clientHeight;
    const yPx = rect.y * pageHeight;

    container.scrollTo({
      top: pageTop + yPx - 40,
      behavior: "smooth",
    });
  }, []);

  useImperativeHandle(ref, () => ({ goToAnchor }), [goToAnchor]);

  // Comment handlers
  const openCreateComment = useCallback((anchor: Anchor, x: number, y: number) => {
    const pos = normalizePanelPos(x, y);
    setDraft({
      mode: "create",
      anchor,
      x: pos.x,
      y: pos.y,
      text: "",
      ideaType: IdeaType.CLAIM,
      relateToIdeaId: "",
      relationType: "",
      relationDirection: "THIS_TO_TARGET",
      justification: "",
    });
  }, []);

  const openEditComment = useCallback((anchor: Anchor, x: number, y: number) => {
    const existing = ideaByAnchorId.get(anchor.anchorId);
    if (!existing) {
      openCreateComment(anchor, x, y);
      return;
    }

    const pos = normalizePanelPos(x, y);
    setDraft({
      mode: "edit",
      anchor,
      x: pos.x,
      y: pos.y,
      ideaId: existing.ideaId,
      text: existing.rephrase,
      ideaType: existing.type,
      relateToIdeaId: "",
      relationType: "",
      relationDirection: "THIS_TO_TARGET",
      justification: "",
    });
  }, [ideaByAnchorId, openCreateComment]);

  // DRAG OPTIMIZADO - Eventos nativos del DOM
  useEffect(() => {
    if (!draft || !commentBoxRef.current) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Solo arrastrar desde el header
      const header = commentBoxRef.current?.querySelector('.comment-header');
      if (!header || !header.contains(e.target as Node)) return;

      e.preventDefault();
      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        initialX: draft.x,
        initialY: draft.y,
      };

      // Agregar estilos durante el drag
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const w = 360;
      const h = 420;
      const pad = 10;
      const maxX = window.innerWidth - w - pad;
      const maxY = window.innerHeight - h - pad;

      const deltaX = e.clientX - dragState.current.startX;
      const deltaY = e.clientY - dragState.current.startY;

      const newX = clamp(dragState.current.initialX + deltaX, pad, maxX);
      const newY = clamp(dragState.current.initialY + deltaY, pad, maxY);

      // Actualizar posición usando transform para mejor rendimiento
      const commentBox = commentBoxRef.current;
      if (commentBox) {
        commentBox.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };

    const handleMouseUp = () => {
      if (!dragState.current.isDragging) return;

      // Actualizar estado con la posición final
      const commentBox = commentBoxRef.current;
      if (commentBox) {
        const rect = commentBox.getBoundingClientRect();
        setDraft(prev => prev ? {
          ...prev,
          x: rect.left,
          y: rect.top
        } : prev);
      }

      dragState.current.isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const header = commentBoxRef.current.querySelector('.comment-header');
    if (header) {
      header.addEventListener('mousedown', handleMouseDown);
    }

    // Usar eventos del documento para mejor rendimiento
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (header) {
        header.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Limpiar estilos
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [draft]);

  // Save comment
  const saveDraft = async () => {
    if (!draft) return;

    const text = draft.text.trim();
    if (text.length < 10) {
      alert("El comentario debe tener al menos 10 caracteres.");
      return;
    }

    // Prepare anchor
    const anchor: Anchor = {
      ...draft.anchor,
      projectId: "demo-project",
      sourceId: file,
      createdAt: draft.anchor.createdAt ?? new Date().toISOString(),
    };

    // 1. Save anchor and highlight
    await addAnchor(anchor);
    await addHighlight({
      highlightId: crypto.randomUUID(),
      anchorId: anchor.anchorId,
      color: "#fde047",
      createdAt: new Date().toISOString(),
    });

    // 2. Create or update idea
    let thisIdeaId: string;

    if (draft.mode === "create") {
      thisIdeaId = crypto.randomUUID();
      const idea: Idea = {
        ideaId: thisIdeaId,
        projectId: "demo-project",
        sourceId: file,
        anchorId: anchor.anchorId,
        type: draft.ideaType,
        rephrase: text,
        origin: IdeaOrigin.FROM_COMMENT,
        status: IdeaStatus.DRAFT,
        confidence: 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addIdea(idea);
    } else {
      if (!draft.ideaId) return;
      thisIdeaId = draft.ideaId;
      await updateIdea(thisIdeaId, {
        rephrase: text,
        type: draft.ideaType,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Optional relation
    if (draft.relateToIdeaId && draft.relationType) {
      const fromIdeaId =
        draft.relationDirection === "THIS_TO_TARGET"
          ? thisIdeaId
          : draft.relateToIdeaId;

      const toIdeaId =
        draft.relationDirection === "THIS_TO_TARGET"
          ? draft.relateToIdeaId
          : thisIdeaId;

      await addRelation({
        relationId: crypto.randomUUID(),
        projectId: "demo-project",
        fromIdeaId,
        toIdeaId,
        relationType: draft.relationType,
        justification: draft.justification?.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    // 4. Notify parent
    onRequestComment?.(anchor);
    setDraft(null);
  };

  if (!pdf) {
    return (
      <div style={{ padding: 16, color: "#94a3b8" }}>
        Cargando PDF…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflowY: "auto",
        height: "100vh",
        width: "100%",
        padding: 24,
        background: "#020617",
      }}
    >
      {Array.from({ length: pdf.numPages }, (_, i) => {
        const pageNumber = i + 1;
        return (
          <div
            key={pageNumber}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNumber, el);
              else pageRefs.current.delete(pageNumber);
            }}
            data-page-number={pageNumber}
          >
            <PdfPage
              highlightColorByAnchorId={highlightColorByAnchorId}
              pdf={pdf}
              pageNumber={pageNumber}
              anchors={anchorsForFile}
              commentedAnchorIds={commentedAnchorIds}
              onHighlight={({ quote, pageNumber, rects, color }) => {
                const anchorId = crypto.randomUUID();
                const anchor: Anchor = {
                  anchorId,
                  projectId: "demo-project",
                  sourceId: file,
                  pageNumber,
                  quote,
                  rects,
                  resolverStrategy: "QUOTE_CONTEXT",
                  resolverConfidence: 1,
                  createdAt: new Date().toISOString(),
                };

                addAnchor(anchor);
                addHighlight({
                  highlightId: crypto.randomUUID(),
                  anchorId,
                  color,
                  createdAt: new Date().toISOString(),
                });
              }}
              onRequestComment={(payload) => {
                const anchor: Anchor = {
                  anchorId: crypto.randomUUID(),
                  projectId: "demo-project",
                  sourceId: file,
                  pageNumber: payload.pageNumber,
                  quote: payload.quote,
                  rects: payload.rects,
                  resolverStrategy: "QUOTE_CONTEXT",
                  resolverConfidence: 1,
                  createdAt: new Date().toISOString(),
                };
                openCreateComment(
                  anchor,
                  payload.clientX + 10,
                  payload.clientY + 10
                );
              }}
              onOpenComment={({ anchor, clientX, clientY }) => {
                openEditComment(anchor, clientX + 10, clientY + 10);
              }}
            />
          </div>
        );
      })}

      {/* Floating Comment Box - OPTIMIZADO */}
      {draft && (
        <div
          ref={commentBoxRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            transform: `translate(${draft.x}px, ${draft.y}px)`,
            width: 360,
            background: "#0b1220",
            color: "white",
            border: "1px solid rgba(148,163,184,0.28)",
            borderRadius: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,.55)",
            zIndex: 100000,
            overflow: "hidden",
            transition: dragState.current.isDragging ? "none" : "transform 0.1s ease",
            willChange: dragState.current.isDragging ? "transform" : "auto",
          }}
        >
          {/* Header - Área de drag */}
          <div
            className="comment-header"
            style={{
              padding: "10px 12px",
              background: "rgba(2,6,23,0.9)",
              borderBottom: "1px solid rgba(148,163,184,0.18)",
              cursor: dragState.current.isDragging ? "grabbing" : "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              💬 {draft.mode === "edit" ? "Editar comentario" : "Nuevo comentario"}
            </div>
            <button
              style={{
                border: "1px solid rgba(148,163,184,0.25)",
                background: "transparent",
                color: "white",
                borderRadius: 10,
                padding: "4px 8px",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onClick={() => setDraft(null)}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Selection preview */}
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Selección:{" "}
              <span style={{ opacity: 1 }}>
                {draft.anchor.quote.slice(0, 120)}
                {draft.anchor.quote.length > 120 ? "…" : ""}
              </span>
            </div>

            {/* Idea Type */}
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Tipo</div>
              <select
                value={draft.ideaType}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, ideaType: e.target.value as IdeaType } : d
                  )
                }
                style={{
                  width: "100%",
                  background: "#0f172a",
                  color: "white",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {Object.values(IdeaType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Comment Text */}
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Comentario</div>
              <textarea
                value={draft.text}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, text: e.target.value } : d))
                }
                placeholder="Redacta aquí…"
                style={{
                  width: "100%",
                  height: 120,
                  resize: "none",
                  background: "#0f172a",
                  color: "white",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  lineHeight: 1.4,
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                Mínimo 10 caracteres.
              </div>
            </div>

            {/* Optional Relation */}
            <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                Relacionar (opcional)
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={draft.relationType}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, relationType: e.target.value as RelationType } : d
                    )
                  }
                  style={{
                    flex: 1,
                    background: "#0f172a",
                    color: "white",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">(sin relación)</option>
                  <option value="SUPPORTS">SUPPORTS</option>
                  <option value="CONTRADICTS">CONTRADICTS</option>
                  <option value="DEPENDS_ON">DEPENDS_ON</option>
                </select>

                <select
                  value={draft.relationDirection}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? { ...d, relationDirection: e.target.value as any }
                        : d
                    )
                  }
                  style={{
                    width: 150,
                    background: "#0f172a",
                    color: "white",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="THIS_TO_TARGET">este → objetivo</option>
                  <option value="TARGET_TO_THIS">objetivo → este</option>
                </select>
              </div>

              <div style={{ marginTop: 8 }}>
                <select
                  value={draft.relateToIdeaId}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, relateToIdeaId: e.target.value } : d
                    )
                  }
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    color: "white",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                  disabled={!draft.relationType}
                >
                  <option value="">
                    {draft.relationType
                      ? "Selecciona una idea objetivo…"
                      : "Selecciona relación primero"}
                  </option>
                  {relationCandidates
                    .filter((i) => i.ideaId !== draft.ideaId)
                    .map((i) => (
                      <option key={i.ideaId} value={i.ideaId}>
                        {i.type}: {i.rephrase.slice(0, 60)}
                        {i.rephrase.length > 60 ? "…" : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginTop: 8 }}>
                <input
                  value={draft.justification}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, justification: e.target.value } : d
                    )
                  }
                  placeholder="Justificación breve (opcional)"
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    color: "white",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    outline: "none",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                style={{
                  flex: 1,
                  background: "rgba(148,163,184,0.18)",
                  color: "white",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 12,
                  padding: "10px 0",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
                onClick={() => setDraft(null)}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(148,163,184,0.25)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(148,163,184,0.18)"}
              >
                Cancelar
              </button>
              <button
                style={{
                  flex: 1,
                  background: "#2563eb",
                  color: "white",
                  border: "1px solid rgba(37,99,235,0.8)",
                  borderRadius: 12,
                  padding: "10px 0",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
                onClick={saveDraft}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1d4ed8"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#2563eb"}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});