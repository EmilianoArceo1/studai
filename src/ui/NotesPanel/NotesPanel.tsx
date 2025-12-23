// components/notes/NotesPanel.tsx
import { useState } from "react";
import { useAppStore } from "../../app/store";
import type { Idea } from "../../domain/entities/Idea";
import { IdeaType } from "../../domain/enums/IdeaType";
import { IdeaOrigin } from "../../domain/enums/IdeaOrigin";
import { IdeaStatus } from "../../domain/enums/IdeaStatus";
import { v4 as uuid } from "uuid";

interface Props {
  onGoToPage?: (pageNumber: number) => void;
}

export function NotesPanel({ onGoToPage }: Props) {
  const {
    ideas,
    addIdea,
    addRelation,
    getAnchorPageForIdea,
  } = useAppStore();

  const getFlags = useAppStore((s) => s.getCognitiveFlags);
  const flagsByIdea = getFlags();

  const [rephrase, setRephrase] = useState("");
  const [type, setType] = useState<IdeaType>(IdeaType.CLAIM);
  const [error, setError] = useState<string | null>(null);

  // ───────────── Crear Idea (SIN supuestos ocultos) ─────────────
  const submit = async () => {
    setError(null);

    if (!rephrase.trim()) {
      setError("La idea no puede estar vacía");
      return;
    }

    const idea: Idea = {
      ideaId: uuid(),
      projectId: "demo-project",
      type,
      rephrase,
      origin: IdeaOrigin.MANUAL,
      status: IdeaStatus.DRAFT,
      confidence: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await addIdea(idea);
      setRephrase("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ───────────── Crear relación (demo) ─────────────
  const createRelation = async () => {
    if (ideas.length < 2) return;

    await addRelation({
      relationId: uuid(),
      projectId: "demo-project",
      fromIdeaId: ideas[0].ideaId,
      toIdeaId: ideas[1].ideaId,
      relationType: "SUPPORTS",
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <h2>Ideas</h2>

      <div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as IdeaType)}
        >
          {Object.values(IdeaType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Reformula con tus propias palabras"
          value={rephrase}
          onChange={(e) => setRephrase(e.target.value)}
        />

        <button onClick={submit}>Guardar idea</button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      <ul>
        {ideas.map((idea) => (
          <li
            key={idea.ideaId}
            style={{ cursor: "pointer" }}
            onClick={() => {
              const page = getAnchorPageForIdea(idea.ideaId);
              if (page) {
                onGoToPage?.(page);
              }
            }}
          >
            <strong>{idea.type}</strong> — {idea.rephrase}

            {flagsByIdea.get(idea.ideaId)?.map((flag) => (
              <span
                key={flag}
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  border: "1px solid #999",
                  fontSize: 12,
                }}
              >
                {flag}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <button onClick={createRelation}>
        Crear relación (idea 1 SUPPORTS idea 2)
      </button>
    </div>
  );
}
