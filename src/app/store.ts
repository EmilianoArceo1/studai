// app/store.ts
import { create } from "zustand";
import type { Idea } from "../domain/entities/Idea";
import type { Anchor } from "../domain/entities/Anchor";
import type { Relation } from "../domain/entities/Relation";
import type { IdeaAnchor } from "../domain/entities/IdeaAnchor";
import type { Highlight } from "../domain/entities/Highlight";
import type { CognitiveFlag } from "../domain/enums/CognitiveFlag";

import { db } from "../storage/db";
import { validateIdea } from "../domain/invariants/validators";
import { validateRelation } from "../domain/invariants/validateRelation";
import { analyzeIdeas } from "../domain/services/cognitiveAnalysis";

interface AppState {
  // Ideas
  ideas: Idea[];
  loadIdeas: () => Promise<void>;
  addIdea: (idea: Idea) => Promise<void>;

  // Anchors
  anchors: Anchor[];
  loadAnchors: () => Promise<void>;
  addAnchor: (anchor: Anchor) => Promise<void>;
  getAnchorById: (anchorId: string) => Anchor | null;

  // Idea ↔ Anchor
  ideaAnchors: IdeaAnchor[];
  loadIdeaAnchors: () => Promise<void>;
  linkIdeaToAnchor: (ideaId: string, anchorId: string) => Promise<void>;
  getAnchorForIdea: (ideaId: string) => Anchor | null;

  // Relations
  relations: Relation[];
  loadRelations: () => Promise<void>;
  addRelation: (relation: Relation) => Promise<void>;

  // Highlights
  highlights: Highlight[];
  loadHighlights: () => Promise<void>;
  addHighlight: (h: Highlight) => Promise<void>;

  // Cognitive
  getCognitiveFlags: () => Map<string, CognitiveFlag[]>;
  getStudyQueue: () => {
    idea: Idea;
    flags: CognitiveFlag[];
  }[];

  updateIdea: (ideaId: string, patch: Partial<Idea>) => Promise<void>;
toggleIdeaHiddenFromNotes: (ideaId: string, hidden: boolean) => Promise<void>;

  
}

export const useAppStore = create<AppState>((set, get) => ({
  /* ───────── Ideas ───────── */

  ideas: [],

  loadIdeas: async () => {
    const ideas = await db.ideas.toArray();
    set({ ideas });
  },

  addIdea: async (idea) => {
    validateIdea(idea);
    await db.ideas.put(idea);
    set((s) => ({
      ideas: s.ideas.some((i) => i.ideaId === idea.ideaId)
        ? s.ideas
        : [...s.ideas, idea],
    }));
  },

  /* ───────── Anchors ───────── */

  anchors: [],

  loadAnchors: async () => {
    const anchors = await db.anchors.toArray();
    set({ anchors });
  },

  addAnchor: async (anchor) => {
    await db.anchors.put(anchor);
    set((s) => ({
      anchors: s.anchors.some((a) => a.anchorId === anchor.anchorId)
        ? s.anchors
        : [...s.anchors, anchor],
    }));
  },

  getAnchorById: (anchorId) => {
    return get().anchors.find((a) => a.anchorId === anchorId) ?? null;
  },

  /* ───── Idea ↔ Anchor ───── */

  ideaAnchors: [],

  loadIdeaAnchors: async () => {
    const ideaAnchors = await db.ideaAnchors.toArray();
    set({ ideaAnchors });
  },

  linkIdeaToAnchor: async (ideaId, anchorId) => {
    const link: IdeaAnchor = {
      ideaAnchorId: crypto.randomUUID(),
      ideaId,
      anchorId,
      createdAt: new Date().toISOString(),
    };

    await db.ideaAnchors.put(link);
    set((s) => ({
      ideaAnchors: s.ideaAnchors.some(
        (ia) => ia.ideaId === ideaId && ia.anchorId === anchorId
      )
        ? s.ideaAnchors
        : [...s.ideaAnchors, link],
    }));
  },

  getAnchorForIdea: (ideaId) => {
    const { ideaAnchors, anchors } = get();

    const link = ideaAnchors.find((ia) => ia.ideaId === ideaId);
    if (!link) return null;

    return anchors.find((a) => a.anchorId === link.anchorId) ?? null;
  },

  /* ───────── Relations ───────── */

  relations: [],

  loadRelations: async () => {
    const relations = await db.relations.toArray();
    set({ relations });
  },

  addRelation: async (relation) => {
    validateRelation(relation);
    await db.relations.put(relation);
    set((s) => ({
      relations: s.relations.some(
        (r) => r.relationId === relation.relationId
      )
        ? s.relations
        : [...s.relations, relation],
    }));
  },

  /* ───────── Highlights ───────── */

  highlights: [],

  loadHighlights: async () => {
    const highlights = await db.highlights.toArray();
    set({ highlights });
  },

  addHighlight: async (h) => {
    await db.highlights.put(h);
    set((s) => ({
      highlights: s.highlights.some(
        (x) => x.highlightId === h.highlightId
      )
        ? s.highlights
        : [...s.highlights, h],
    }));
  },

  /* ───────── Cognitive ───────── */

  getCognitiveFlags: () => {
    const { ideas, relations } = get();
    return analyzeIdeas(ideas, relations);
  },

  getStudyQueue: () => {
    const { ideas, relations } = get();
    const flagsByIdea = analyzeIdeas(ideas, relations);

    const priority: Record<CognitiveFlag, number> = {
      CONTRADICTION: 1,
      UNRESOLVED_CONTRADICTION: 2,
      UNSUPPORTED_CLAIM: 3,
      LOW_CONFIDENCE: 4,
    };

    return ideas
      .map((idea) => ({
        idea,
        flags: flagsByIdea.get(idea.ideaId) ?? [],
      }))
      .filter((x) => x.flags.length > 0)
      .sort((a, b) => {
        const pa = Math.min(...a.flags.map((f) => priority[f] ?? 99));
        const pb = Math.min(...b.flags.map((f) => priority[f] ?? 99));
        return pa - pb;
      });
  },

  updateIdea: async (ideaId, patch) => {
  await db.ideas.update(ideaId, patch);
  set((s) => ({
    ideas: s.ideas.map((i) =>
      i.ideaId === ideaId ? { ...i, ...patch } : i
    ),
  }));
},

toggleIdeaHiddenFromNotes: async (ideaId, hidden) => {
  await db.ideas.update(ideaId, { hiddenFromNotes: hidden });
  set((s) => ({
    ideas: s.ideas.map((i) =>
      i.ideaId === ideaId ? { ...i, hiddenFromNotes: hidden } : i
    ),
  }));
},

}));
