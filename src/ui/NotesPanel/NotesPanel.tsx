import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import type { Anchor } from "../../domain/entities/Anchor";
import { IdeaOrigin } from "../../domain/enums/IdeaOrigin";

interface Props {
  onGoToAnchor?: (anchor: Anchor) => void;
  onEditComment?: (anchor: Anchor) => void;
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function getRangeFromPoint(x: number, y: number): Range | null {
  // Chrome/Edge
  const anyDoc = document as any;
  if (typeof anyDoc.caretRangeFromPoint === "function") {
    return anyDoc.caretRangeFromPoint(x, y) as Range;
  }
  // Firefox
  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

export function NotesPanel({ onGoToAnchor, onEditComment }: Props) {
  const ideas = useAppStore((s) => s.ideas);
  const anchors = useAppStore((s) => s.anchors);
  const toggleHidden = useAppStore((s) => s.toggleIdeaHiddenFromNotes);

  const editorRef = useRef<HTMLDivElement>(null);
  const dragTimerRef = useRef<number | null>(null);
  // ===== ADD: caret visual para drop =====
  const dropCaretRef = useRef<HTMLDivElement | null>(null);

  const [noteTitle, setNoteTitle] = useState("Apuntes");
  const [hasContent, setHasContent] = useState(false);

  const [hovered, setHovered] = useState<{
    anchor: Anchor;
    x: number;
    y: number;
    ideaId: string;
  } | null>(null);

  // “Modo drag” activado solo por intención (dblclick o long-press)
  const [dragArmedIdeaId, setDragArmedIdeaId] = useState<string | null>(null);

  // ===== ADD: menú contextual =====
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  ideaId: string;
} | null>(null);


  const commentIdeas = useMemo(
    () =>
      ideas
        .filter((i) => i.origin === IdeaOrigin.FROM_COMMENT)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [ideas]
  );

  const anchorById = useMemo(() => {
    const m = new Map<string, Anchor>();
    anchors.forEach((a) => m.set(a.anchorId, a));
    return m;
  }, [anchors]);

  const ideaById = useMemo(() => {
    const m = new Map<string, (typeof commentIdeas)[number]>();
    commentIdeas.forEach((i) => m.set(i.ideaId, i));
    return m;
  }, [commentIdeas]);

  /* ───────── Placeholder detection ───────── */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const update = () => setHasContent((el.textContent ?? "").trim().length !== 0);

    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, []);

  /* ───────── Keyboard shortcuts: undo/redo + format ───────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const k = e.key.toLowerCase();

      // Undo / Redo
      if (k === "z") {
        e.preventDefault();
        exec(e.shiftKey ? "redo" : "undo");
        return;
      }
      if (k === "y") {
        e.preventDefault();
        exec("redo");
        return;
      }

      // Basic formatting
      if (k === "b") {
        e.preventDefault();
        exec("bold");
        return;
      }
      if (k === "i") {
        e.preventDefault();
        exec("italic");
        return;
      }
      if (k === "u") {
        e.preventDefault();
        exec("underline");
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focusEditor = () => editorRef.current?.focus();

  const makeLink = () => {
    focusEditor();
    const url = window.prompt("Pega el link (https://...)");
    if (!url) return;
    exec("createLink", url);
  };

  /* ───────── DOM-owned comments (no React children inside editor) ─────────
     - Inserta spans nuevos al final cuando llegan ideas nuevas.
     - Actualiza estilo/texto de spans existentes cuando cambia hidden/label.
     - NO recrea spans -> si el usuario los movió (drag), se respeta.
  */
  useEffect(() => {
    
    const el = editorRef.current;
    if (!el) return;

    // Index existing spans by ideaId
    const existing = new Map<string, HTMLSpanElement>();
    el.querySelectorAll<HTMLSpanElement>('span[data-idea-id="1"]').forEach((s) => {
      const id = s.getAttribute("data-id");
      if (id) existing.set(id, s);
    });

    for (const idea of commentIdeas) {
      const span = existing.get(idea.ideaId) ?? document.createElement("span");

      // If new, append at end (tu comportamiento actual)
      if (!existing.has(idea.ideaId)) {
        span.appendChild(document.createTextNode("")); // placeholder node
        el.appendChild(span);
        el.appendChild(document.createTextNode(" ")); // espacio natural
      }

      // Common attributes
      span.setAttribute("data-idea-id", "1");
      span.setAttribute("data-id", idea.ideaId);
      span.setAttribute("contenteditable", "false");
      span.style.padding = "0 4px";
      span.style.borderRadius = "3px";
      span.style.boxDecorationBreak = "clone";
      (span.style as any).WebkitBoxDecorationBreak = "clone";

      // Visual state
      const hidden = !!idea.hiddenFromNotes;
      span.setAttribute("data-hidden", hidden ? "1" : "0");
      span.style.background = hidden
        ? "rgba(148,163,184,0.12)"
        : "rgba(253,224,71,0.22)";

      // Cursor: normal click behavior unless drag-armed
      const isArmed = dragArmedIdeaId === idea.ideaId;
      span.style.cursor = isArmed ? "grab" : "pointer";
      span.draggable = isArmed;

      // Text content (keep it simple, we avoid nested nodes to not complicate moving)
      span.textContent = hidden ? "..." : idea.rephrase;
    }
  }, [commentIdeas, dragArmedIdeaId]);

  /* ───────── Event delegation for spans inside editor ───────── */
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
  const span = findIdeaSpan(e.target);
  if (!span) return;

  e.preventDefault();

  const ideaId = span.getAttribute("data-id");
  if (!ideaId) return;

  setContextMenu({
    x: e.clientX,
    y: e.clientY,
    ideaId,
  });
};

    const el = editorRef.current;
    if (!el) return;

    const findIdeaSpan = (t: EventTarget | null): HTMLSpanElement | null => {
      const node = t as HTMLElement | null;
      if (!node) return null;
      const span = node.closest?.('span[data-idea-id="1"]') as HTMLSpanElement | null;
      return span;
    };

    const onMouseMove = (e: MouseEvent) => {
      // keep tooltip glued to cursor while hovering that same idea
      const span = findIdeaSpan(e.target);
      if (!span) return;
      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;
      if (!hovered || hovered.ideaId !== ideaId) return;
      setHovered((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    };

    const onMouseEnterCapture = (e: Event) => {
      const me = e as MouseEvent;
      const span = findIdeaSpan(me.target);
      if (!span) return;

      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      const idea = ideaById.get(ideaId);
      if (!idea?.anchorId) return;

      const anchor = anchorById.get(idea.anchorId);
      if (!anchor) return;

      setHovered({ anchor, x: me.clientX, y: me.clientY, ideaId });
    };

    const onMouseLeaveCapture = (e: Event) => {
      const span = findIdeaSpan((e as MouseEvent).target);
      if (!span) return;
      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      setHovered((prev) => (prev?.ideaId === ideaId ? null : prev));
    };

    const onDoubleClick = (e: MouseEvent) => {
      const span = findIdeaSpan(e.target);
      if (!span) return;
      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      // Arm drag mode immediately
      setDragArmedIdeaId(ideaId);
    };

    const onMouseDown = (e: MouseEvent) => {
      const span = findIdeaSpan(e.target);
      if (!span) return;

      // Long-press: arm drag after 250ms
      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }

      dragTimerRef.current = window.setTimeout(() => {
        setDragArmedIdeaId(ideaId);
      }, 250);
    };

    const onMouseUp = () => {
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const span = findIdeaSpan(e.target);
      if (!span) return;

      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      // If click is on the eye area we fake with modifier: Alt-click toggles (simple + reliable)
      // But you want the eye icon, not modifier. So we render tooltip action button instead.
      // For inline toggle, we use: Shift+Click on span to toggle hidden (doesn't break selection).
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleHidden(ideaId, span.getAttribute("data-hidden") !== "1");
        return;
      }

      // Normal click navigates to anchor (unless you are dragging)
      if (dragArmedIdeaId === ideaId) return;

      const idea = ideaById.get(ideaId);
      if (!idea?.anchorId) return;

      const anchor = anchorById.get(idea.anchorId);
      if (!anchor) return;

      onGoToAnchor?.(anchor);
    };

    const onDragStart = (e: DragEvent) => {
      const span = findIdeaSpan(e.target);
      if (!span) return;

      const ideaId = span.getAttribute("data-id");
      if (!ideaId) return;

      // Only allow if armed
      if (dragArmedIdeaId !== ideaId) {
        e.preventDefault();
        return;
      }

      // Put id in dataTransfer
      e.dataTransfer?.setData("text/plain", ideaId);
      // Better UX
      span.style.cursor = "grabbing";
    };

    const onDragEnd = (e: DragEvent) => {
      if (dropCaretRef.current) {
      dropCaretRef.current.remove();
      dropCaretRef.current = null;
    }

      const span = findIdeaSpan(e.target);
      if (span) span.style.cursor = "pointer";
      // disarm after drag ends
      setDragArmedIdeaId(null);
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseenter", onMouseEnterCapture, true);
    el.addEventListener("mouseleave", onMouseLeaveCapture, true);
    el.addEventListener("dblclick", onDoubleClick);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClick);
    el.addEventListener("dragstart", onDragStart as any);
    el.addEventListener("dragend", onDragEnd as any);
    el.addEventListener("contextmenu", onContextMenu);


    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseenter", onMouseEnterCapture, true);
      el.removeEventListener("mouseleave", onMouseLeaveCapture, true);
      el.removeEventListener("dblclick", onDoubleClick);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClick);
      el.removeEventListener("dragstart", onDragStart as any);
      el.removeEventListener("dragend", onDragEnd as any);
      el.removeEventListener("contextmenu", onContextMenu);

    };
  }, [
    anchorById,
    ideaById,
    onGoToAnchor,
    toggleHidden,
    dragArmedIdeaId,
    hovered,
  ]);
  // ===== ADD: mostrar caret naranja durante drag =====
const handleDragOverWithCaret = (e: React.DragEvent) => {
  e.preventDefault();

  const r = getRangeFromPoint(e.clientX, e.clientY);
  if (!r) return;

  const rect = r.getBoundingClientRect();

  if (!dropCaretRef.current) {
    const caret = document.createElement("div");
    caret.style.position = "fixed";
    caret.style.width = "2px";
    caret.style.background = "#f97316"; // naranja
    caret.style.zIndex = "99999";
    caret.style.pointerEvents = "none";
    dropCaretRef.current = caret;
    document.body.appendChild(caret);
  }

  dropCaretRef.current.style.left = `${rect.left}px`;
  dropCaretRef.current.style.top = `${rect.top}px`;
  dropCaretRef.current.style.height = `${rect.height}px`;
};


  /* ───────── Drop: MOVE existing node (no duplication) ───────── */
  const handleDrop = (e: React.DragEvent) => {
    // ===== ADD: limpiar caret visual =====
    if (dropCaretRef.current) {
      dropCaretRef.current.remove();
      dropCaretRef.current = null;
    }

    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;

    const ideaId = e.dataTransfer.getData("text/plain");
    if (!ideaId) return;

    const span = el.querySelector<HTMLSpanElement>(
      `span[data-idea-id="1"][data-id="${CSS.escape(ideaId)}"]`
    );
    if (!span) return;

    // Find insertion point
    const r = getRangeFromPoint(e.clientX, e.clientY);
    if (!r) return;

    // Avoid dropping into itself (no-op)
    if (r.startContainer === span || span.contains(r.startContainer)) return;

    // Move: insert the SAME node at range
    r.insertNode(span);

    // Ensure a space after the moved span for readability
    // (only if next sibling isn't a text node starting with space)
    const next = span.nextSibling;
    if (!(next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "").startsWith(" "))) {
      span.parentNode?.insertBefore(document.createTextNode(" "), span.nextSibling);
    }

    setDragArmedIdeaId(null);
  };

  /* ───────── Toolbar actions ───────── */
  const insertInlineCode = () => {
    focusEditor();
    const sel = window.getSelection();
    const hasSel = !!sel && sel.rangeCount > 0 && !sel.isCollapsed;
    if (hasSel) exec("insertHTML", `<code>${sel?.toString() ?? ""}</code>`);
    else exec("insertHTML", "<code>código</code>");
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0b1220",
        color: "#e5e7eb",
        borderLeft: "1px solid #1f2937",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ───────── Top bar (sticky) ───────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(2,6,23,0.96)",
          borderBottom: "1px solid #1f2937",
          padding: "12px 12px 10px",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Nombre de apuntes"
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid rgba(148,163,184,0.25)",
              color: "#e5e7eb",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 14,
              outline: "none",
            }}
          />

          <IconButton
            title="Deshacer (Ctrl/Cmd+Z)"
            label="↶"
            onClick={() => {
              focusEditor();
              exec("undo");
            }}
          />
          <IconButton
            title="Rehacer (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)"
            label="↷"
            onClick={() => {
              focusEditor();
              exec("redo");
            }}
          />
        </div>

        {/* Toolbar row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <Group>
            <Tb label="B" title="Negrita (Ctrl/Cmd+B)" onClick={() => exec("bold")} />
            <Tb label="I" title="Cursiva (Ctrl/Cmd+I)" onClick={() => exec("italic")} />
            <Tb label="U" title="Subrayado (Ctrl/Cmd+U)" onClick={() => exec("underline")} />
            <Tb label="S" title="Tachado" onClick={() => exec("strikeThrough")} />
          </Group>

          <Divider />

          <Group>
            <Tb label="H1" title="Título grande" onClick={() => exec("formatBlock", "h1")} />
            <Tb label="H2" title="Título mediano" onClick={() => exec("formatBlock", "h2")} />
            <Tb label="P" title="Párrafo" onClick={() => exec("formatBlock", "p")} />
          </Group>

          <Divider />

          <Group>
            <Tb label="•" title="Lista" onClick={() => exec("insertUnorderedList")} />
            <Tb label="1." title="Lista numerada" onClick={() => exec("insertOrderedList")} />
            <Tb label="❝" title="Cita" onClick={() => exec("formatBlock", "blockquote")} />
          </Group>

          <Divider />

          <Group>
            <Tb label="≡" title="Justificar" onClick={() => exec("justifyFull")} />
            <Tb label="⇤" title="Alinear izquierda" onClick={() => exec("justifyLeft")} />
            <Tb label="↔" title="Centrar" onClick={() => exec("justifyCenter")} />
            <Tb label="⇥" title="Alinear derecha" onClick={() => exec("justifyRight")} />
          </Group>

          <Divider />

          <Group>
            <Tb label="</>" title="Código inline" onClick={insertInlineCode} />
            <Tb label="🔗" title="Link" onClick={makeLink} />
            <Tb label="Tx" title="Limpiar formato" onClick={() => exec("removeFormat")} />
          </Group>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.55 }}>
          Tip: <b>Shift+Click</b> en comentario = ocultar/mostrar. <b>Doble click</b> o{" "}
          <b>click sostenido</b> = activar arrastre.
        </div>
      </div>

      {/* ───────── Editor area ───────── */}
      <div
        style={{ position: "relative", padding: "16px 18px", flex: 1, overflowY: "auto" }}
        onDragOver={handleDragOverWithCaret}
        onDrop={handleDrop}
      >

        {!hasContent && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 18,
              color: "rgba(148,163,184,0.45)",
              pointerEvents: "none",
              fontSize: 15,
              lineHeight: 1.8,
            }}
          >
            Empieza a escribir… luego añade comentarios desde el PDF.
          </div>
        )}

        {/* Editable text (DOM-owned content) */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            minHeight: 300,
            fontSize: 15,
            lineHeight: 1.8,
            outline: "none",
            whiteSpace: "normal",
          }}
        />
      </div>

      {/* ───────── Tooltip contextual junto al cursor ───────── */}
      {hovered && (
        <div
          style={{
            position: "fixed",
            top: hovered.y + 12,
            left: hovered.x + 12,
            maxWidth: 360,
            background: "rgba(2,6,23,0.94)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13,
            color: "#e5e7eb",
            zIndex: 99999,
            boxShadow: "0 10px 30px rgba(0,0,0,.4)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ opacity: 0.6 }}>Página {hovered.anchor.pageNumber}</div>

          <div style={{ fontStyle: "italic", marginTop: 4 }}>“{hovered.anchor.quote}”</div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div
              style={{ color: "#60a5fa", cursor: "pointer" }}
              onClick={() => {
                onEditComment?.(hovered.anchor);
                setHovered(null);
              }}
            >
              Editar comentario
            </div>

            <div
              style={{ color: "rgba(229,231,235,0.85)", cursor: "pointer" }}
              onClick={() => {
                // toggle hidden by the hovered ideaId
                const idea = ideaById.get(hovered.ideaId);
                if (!idea) return;
                toggleHidden(idea.ideaId, !idea.hiddenFromNotes);
              }}
              title="Ocultar/mostrar"
            >
              {(() => {
                const idea = ideaById.get(hovered.ideaId);
                return idea?.hiddenFromNotes ? "🙈 Mostrar" : "👁️ Ocultar";
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===== Context menu (click derecho) ===== */}
{contextMenu && (
  <div
    style={{
      position: "fixed",
      top: contextMenu.y,
      left: contextMenu.x,
      background: "#020617",
      border: "1px solid #334155",
      borderRadius: 10,
      padding: 8,
      zIndex: 100000,
      boxShadow: "0 10px 30px rgba(0,0,0,.45)",
    }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    <div
      style={{ padding: "6px 10px", cursor: "pointer" }}
      onClick={() => {
        const idea = ideaById.get(contextMenu.ideaId);
        if (idea?.anchorId) {
          const anchor = anchorById.get(idea.anchorId);
          if (anchor) onEditComment?.(anchor);
        }
        setContextMenu(null);
      }}
    >
      ✏️ Editar comentario
    </div>

    <div
      style={{ padding: "6px 10px", cursor: "pointer" }}
      onClick={() => {
        const idea = ideaById.get(contextMenu.ideaId);
        if (idea) toggleHidden(idea.ideaId, !idea.hiddenFromNotes);
        setContextMenu(null);
      }}
    >
      👁️ / 🙈 Ocultar
    </div>
  </div>
)}

    </div>
  );
}

/* ───────── UI helpers ───────── */

function Tb({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // no perder selección
      onClick={onClick}
      style={{
        padding: "6px 8px",
        borderRadius: 8,
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(15,23,42,0.6)",
        color: "#e5e7eb",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function IconButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(15,23,42,0.6)",
        color: "#e5e7eb",
        fontSize: 16,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
      }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 26,
        background: "rgba(148,163,184,0.22)",
        margin: "0 2px",
        alignSelf: "center",
      }}
    />
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 6 }}>{children}</div>;
}

