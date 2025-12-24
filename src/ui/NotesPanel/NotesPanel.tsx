import { useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import type { Anchor } from "../../domain/entities/Anchor";
import type { Idea } from "../../domain/entities/Idea";
import type { Relation } from "../../domain/entities/Relation";
import { IdeaOrigin } from "../../domain/enums/IdeaOrigin";

interface Props {
  onGoToAnchor?: (anchor: Anchor) => void;
}

/* ───────── Helpers ───────── */

function colorForIdea(ideaId: string, relations: Relation[]) {
  const rels = relations.filter(
    (r) => r.fromIdeaId === ideaId || r.toIdeaId === ideaId
  );

  if (rels.some((r) => r.relationType === "CONTRADICTS"))
    return "rgba(239,68,68,0.12)"; // rojo
  if (rels.some((r) => r.relationType === "DEPENDS_ON"))
    return "rgba(234,179,8,0.12)"; // amarillo
  if (rels.some((r) => r.relationType === "SUPPORTS"))
    return "rgba(34,197,94,0.12)"; // verde

  return "rgba(148,163,184,0.08)"; // neutro
}

/* ───────── Component ───────── */

export function NotesPanel({ onGoToAnchor }: Props) {
  const ideas = useAppStore((s) => s.ideas);
  const anchors = useAppStore((s) => s.anchors);
  const relations = useAppStore((s) => s.relations);

  const updateIdea = useAppStore((s) => s.updateIdea);
  const toggleIdeaHiddenFromNotes = useAppStore(
    (s) => s.toggleIdeaHiddenFromNotes
  );

  const [ctx, setCtx] = useState<{
    x: number;
    y: number;
    ideaId: string;
    hidden: boolean;
  } | null>(null);

  /* ───────── Derived data ───────── */

  const commentIdeas = useMemo(() => {
    return ideas
      .filter((i) => i.origin === IdeaOrigin.FROM_COMMENT)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [ideas]);

  const anchorById = useMemo(() => {
    const map = new Map<string, Anchor>();
    anchors.forEach((a) => map.set(a.anchorId, a));
    return map;
  }, [anchors]);

  /* ───────── Render ───────── */

  return (
    <div
      style={{
        width: 460,
        height: "100vh",
        overflowY: "auto",
        background: "#0b1220",
        color: "#e5e7eb",
        borderLeft: "1px solid #1f2937",
      }}
      onClick={() => setCtx(null)}
    >
      {/* Header */}
      <div style={{ padding: 16, borderBottom: "1px solid #1f2937" }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Apuntes</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Comentarios redactados (sin clasificación visible)
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {commentIdeas.map((idea) => {
          const anchor = idea.anchorId
            ? anchorById.get(idea.anchorId)
            : null;

          /* ───── Oculto ───── */
          if (idea.hiddenFromNotes) {
            return (
              <div
                key={idea.ideaId}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(148,163,184,0.08)",
                  border: "1px dashed rgba(148,163,184,0.35)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: anchor ? "pointer" : "default",
                }}
                onClick={() => {
                  if (anchor) onGoToAnchor?.(anchor);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({
                    x: e.clientX,
                    y: e.clientY,
                    ideaId: idea.ideaId,
                    hidden: true,
                  });
                }}
              >
                <span style={{ fontSize: 16 }}>🙈</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>
                  Comentario oculto
                </span>
              </div>
            );
          }

          /* ───── Visible ───── */
          const bg = colorForIdea(idea.ideaId, relations);

          return (
            <div
              key={idea.ideaId}
              style={{
                padding: 12,
                borderRadius: 10,
                background: bg,
                border: "1px solid rgba(148,163,184,0.18)",
                cursor: anchor ? "pointer" : "default",
              }}
              onClick={() => {
                if (anchor) onGoToAnchor?.(anchor);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtx({
                  x: e.clientX,
                  y: e.clientY,
                  ideaId: idea.ideaId,
                  hidden: false,
                });
              }}
            >
              <div
                contentEditable
                suppressContentEditableWarning
                style={{
                  outline: "none",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  fontSize: 14,
                }}
                onBlur={(e) => {
                  const text = e.currentTarget.textContent ?? "";
                  if (text !== idea.rephrase) {
                    updateIdea(idea.ideaId, { rephrase: text });
                  }
                }}
              >
                {idea.rephrase}
              </div>

              {anchor && (
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
                  ↳ PDF · pág. {anchor.pageNumber}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {ctx && (
        <div
          style={{
            position: "fixed",
            top: ctx.y,
            left: ctx.x,
            background: "#020617",
            border: "1px solid #334155",
            borderRadius: 10,
            color: "white",
            fontSize: 13,
            zIndex: 99999,
            minWidth: 220,
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
          }}
        >
          <div
            style={{ padding: "10px 12px", cursor: "pointer" }}
            onClick={() => {
              toggleIdeaHiddenFromNotes(ctx.ideaId, !ctx.hidden);
              setCtx(null);
            }}
          >
            {ctx.hidden ? "Mostrar comentario" : "Ocultar comentario"}
          </div>
        </div>
      )}
    </div>
  );
}
