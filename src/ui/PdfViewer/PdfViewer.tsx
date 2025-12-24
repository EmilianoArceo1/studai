// components/pdf/PdfViewer.tsx
import "./pdfWorker";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
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
  onRequestComment?: (anchor: Anchor) => void; // para que Workspace pueda setActiveAnchor si quiere
}

export interface PdfViewerHandle {
  goToAnchor: (anchor: Anchor) => void;
}

type Rect = { x: number; y: number; width: number; height: number };

type CommentDraft = {
  mode: "create" | "edit";
  anchor: Anchor;
  // posición del panel
  x: number;
  y: number;

  // idea
  ideaId?: string;
  text: string;
  ideaType: IdeaType;

  // relación opcional
  relateToIdeaId: string;
  relationType: RelationType | "";
  relationDirection: "THIS_TO_TARGET" | "TARGET_TO_THIS";
  justification: string;
};

export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { file, onRequestComment },
  ref
) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  const anchors = useAppStore((s) => s.anchors);
  const ideas = useAppStore((s) => s.ideas);
  const relations = useAppStore((s) => s.relations);

  const loadAnchors = useAppStore((s) => s.loadAnchors);
  const addAnchor = useAppStore((s) => s.addAnchor);
  const addHighlight = useAppStore((s) => s.addHighlight);

  const addIdea = useAppStore((s) => s.addIdea);
  const updateIdea = useAppStore((s) => s.updateIdea); // requerido para editar
  const addRelation = useAppStore((s) => s.addRelation);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean } | null>(
    null
  );

  /* ───────── Load PDF ───────── */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const loadedPdf = await pdfjsLib.getDocument(file).promise;
      if (!cancelled) setPdf(loadedPdf);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [file]);

  /* ───────── Load anchors ───────── */

  useEffect(() => {
    loadAnchors();
  }, [file, loadAnchors]);

  /* ───────── Navigation ───────── */

  const goToAnchor = (anchor: Anchor) => {
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
  };

  useImperativeHandle(ref, () => ({ goToAnchor }));

  /* ───────── Derived ───────── */

  const anchorsForFile = useMemo(
    () => anchors.filter((a) => a.sourceId === file),
    [anchors, file]
  );

  const commentIdeas = useMemo(
    () => ideas.filter((i) => i.origin === IdeaOrigin.FROM_COMMENT && i.sourceId === file),
    [ideas, file]
  );

  const ideaByAnchorId = useMemo(() => {
    const m = new Map<string, Idea>();
    for (const i of commentIdeas) {
      if (i.anchorId) m.set(i.anchorId, i);
    }
    return m;
  }, [commentIdeas]);

  const commentedAnchorIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of commentIdeas) {
      if (i.anchorId) s.add(i.anchorId);
    }
    return s;
  }, [commentIdeas]);

  const relationCandidates = useMemo(() => {
    // Relacionar contra ideas existentes (todas, o solo comments, tu eliges).
    // Aquí uso todas del proyecto por si luego metes MANUAL también.
    return ideas
      .filter((i) => i.projectId === "demo-project")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [ideas]);

  /* ───────── Open comment editor ───────── */

  const openCreateComment = (anchor: Anchor, x: number, y: number) => {
    setDraft({
      mode: "create",
      anchor,
      x,
      y,
      text: "",
      ideaType: IdeaType.CLAIM,
      relateToIdeaId: "",
      relationType: "",
      relationDirection: "THIS_TO_TARGET",
      justification: "",
    });
  };

  const openEditComment = (anchor: Anchor, x: number, y: number) => {
    const existing = ideaByAnchorId.get(anchor.anchorId);
    if (!existing) {
      openCreateComment(anchor, x, y);
      return;
    }

    setDraft({
      mode: "edit",
      anchor,
      x,
      y,
      ideaId: existing.ideaId,
      text: existing.rephrase,
      ideaType: existing.type,
      relateToIdeaId: "",
      relationType: "",
      relationDirection: "THIS_TO_TARGET",
      justification: "",
    });
  };

  /* ───────── Draggable logic ───────── */

  const onDragStart = (e: React.MouseEvent) => {
    if (!draft) return;
    dragRef.current = {
      dx: e.clientX - draft.x,
      dy: e.clientY - draft.y,
      dragging: true,
    };
  };

  const onDragMove = (e: React.MouseEvent) => {
    if (!draft) return;
    if (!dragRef.current?.dragging) return;

    const nx = e.clientX - dragRef.current.dx;
    const ny = e.clientY - dragRef.current.dy;

    // clamp básico a viewport
    const pad = 8;
    const maxX = window.innerWidth - 360 - pad; // ancho aproximado del panel
    const maxY = window.innerHeight - 220 - pad;

    setDraft((d) =>
      d
        ? {
            ...d,
            x: Math.max(pad, Math.min(maxX, nx)),
            y: Math.max(pad, Math.min(maxY, ny)),
          }
        : d
    );
  };

  const onDragEnd = () => {
    if (dragRef.current) dragRef.current.dragging = false;
  };

  /* ───────── Save comment (create/edit + optional relation) ───────── */

  const saveDraft = async () => {
    if (!draft) return;

    const text = draft.text.trim();
    if (text.length < 10) {
      // no uses alert en producción, pero aquí es rápido
      alert("El comentario debe tener al menos 10 caracteres.");
      return;
    }

    // Asegurar anchor + highlight siempre
    const anchorId = draft.anchor.anchorId || crypto.randomUUID();
    const anchor: Anchor = {
      ...draft.anchor,
      anchorId,
      projectId: "demo-project",
      sourceId: file,
      createdAt: draft.anchor.createdAt ?? new Date().toISOString(),
    };

    // Persist anchor (idempotente si ya existe)
    await addAnchor(anchor);
    await addHighlight({
      highlightId: crypto.randomUUID(),
      anchorId: anchor.anchorId,
      color: "#fde047",
      createdAt: new Date().toISOString(),
    });

    // Crear/editar Idea
    if (draft.mode === "create") {
      const idea: Idea = {
        ideaId: crypto.randomUUID(),
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
      await updateIdea(draft.ideaId, {
        rephrase: text,
        type: draft.ideaType,
        updatedAt: new Date().toISOString(),
      });
    }

    // Relación opcional
    if (draft.relateToIdeaId && draft.relationType) {
      const thisIdeaId =
        draft.mode === "edit"
          ? draft.ideaId!
          : // si create, busca por anchor (ya se insertó arriba)
            (ideas.find((i) => i.anchorId === anchor.anchorId && i.origin === IdeaOrigin.FROM_COMMENT)?.ideaId ??
              null);

      if (thisIdeaId) {
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
    }

    // Notificar afuera (opcional) + navegar
    onRequestComment?.(anchor);
    requestAnimationFrame(() => goToAnchor(anchor));

    setDraft(null);
  };

  if (!pdf) return <div style={{ padding: 16 }}>Cargando PDF…</div>;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflowY: "auto",
        height: "100vh",
        padding: 24,
        background: "#020617",
      }}
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
    >
      {Array.from({ length: pdf.numPages }, (_, i) => {
        const pageNumber = i + 1;

        return (
          <div
            key={pageNumber}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNumber, el);
            }}
            data-page-number={pageNumber}
          >
            <PdfPage
              pdf={pdf}
              pageNumber={pageNumber}
              anchors={anchorsForFile}
              commentedAnchorIds={commentedAnchorIds}
              onHighlight={({ quote, pageNumber, rects }) => {
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
                  color: "#fde047",
                  createdAt: new Date().toISOString(),
                });

                requestAnimationFrame(() => goToAnchor(anchor));
              }}
              onRequestComment={(payload) => {
                // crear anchor “base” para este comentario
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

                // Abrir editor flotante cerca del click
                openCreateComment(anchor, payload.clientX + 10, payload.clientY + 10);
              }}
              onOpenComment={({ anchor, clientX, clientY }) => {
                openEditComment(anchor, clientX + 10, clientY + 10);
              }}
            />
          </div>
        );
      })}

      {/* ───────── Floating Draggable CommentBox ───────── */}
      {draft && (
        <div
          style={{
            position: "fixed",
            top: draft.y,
            left: draft.x,
            width: 360,
            background: "#0b1220",
            color: "white",
            border: "1px solid rgba(148,163,184,0.28)",
            borderRadius: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,.55)",
            zIndex: 100000,
            overflow: "hidden",
          }}
        >
          {/* Header draggable */}
          <div
            onMouseDown={onDragStart}
            style={{
              padding: "10px 12px",
              background: "rgba(2,6,23,0.9)",
              borderBottom: "1px solid rgba(148,163,184,0.18)",
              cursor: "grab",
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
              }}
              onClick={() => setDraft(null)}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Selección: <span style={{ opacity: 1 }}>{draft.anchor.quote.slice(0, 120)}</span>
            </div>

            {/* Tipo */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
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
                  }}
                >
                  {Object.values(IdeaType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Texto */}
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
                Mínimo 10 caracteres. Esto se verá en apuntes tal cual, sin clasificación.
              </div>
            </div>

            {/* Relación opcional */}
            <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                Relacionar (opcional)
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={draft.relationType}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, relationType: e.target.value as any } : d
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
                        ? {
                            ...d,
                            relationDirection: e.target.value as any,
                          }
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
                  }}
                  disabled={!draft.relationType}
                >
                  <option value="">
                    {draft.relationType ? "Selecciona una idea objetivo…" : "Selecciona relación primero"}
                  </option>
                  {relationCandidates
                    .filter((i) => i.ideaId !== draft.ideaId)
                    .map((i) => (
                      <option key={i.ideaId} value={i.ideaId}>
                        {i.type}: {i.rephrase.slice(0, 60)}
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
                }}
                onClick={() => setDraft(null)}
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
                }}
                onClick={saveDraft}
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
