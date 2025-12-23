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

  // Idea ↔ Anchor
  ideaAnchors: IdeaAnchor[];
  loadIdeaAnchors: () => Promise<void>;
  linkIdeaToAnchor: (ideaId: string, anchorId: string) => Promise<void>;
  getAnchorPageForIdea: (ideaId: string) => number | null;

  // Relations
  relations: Relation[];
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
}

export const useAppStore = create<AppState>((set) => ({
  // ───────── Ideas ─────────
  ideas: [],

  loadIdeas: async () => {
    const ideas = await db.ideas.toArray();
    set({ ideas });
  },

  addIdea: async (idea) => {
    validateIdea(idea);
    await db.ideas.put(idea);
    set((s) => ({ ideas: [...s.ideas, idea] }));
  },

  // ───────── Anchors ─────────
  anchors: [],

  loadAnchors: async () => {
    const anchors = await db.anchors.toArray();
    set({ anchors });
  },

  addAnchor: async (anchor) => {
    await db.anchors.put(anchor);
    set((s) => ({ anchors: [...s.anchors, anchor] }));
  },

  // ───── Idea ↔ Anchor ─────
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
    set((s) => ({ ideaAnchors: [...s.ideaAnchors, link] }));
  },

  getAnchorPageForIdea: (ideaId) => {
    const { ideaAnchors, anchors } = useAppStore.getState();

    const link = ideaAnchors.find((ia) => ia.ideaId === ideaId);
    if (!link) return null;

    const anchor = anchors.find((a) => a.anchorId === link.anchorId);
    return anchor?.pageNumber ?? null;
  },

  // ───────── Relations ─────────
  relations: [],

  addRelation: async (relation) => {
    validateRelation(relation);
    await db.relations.put(relation);
    set((s) => ({ relations: [...s.relations, relation] }));
  },

  // ───────── Highlights ─────────
  highlights: [],

  loadHighlights: async () => {
    const highlights = await db.highlights.toArray();
    set({ highlights });
  },

  addHighlight: async (h) => {
    await db.highlights.put(h);
    set((s) => ({ highlights: [...s.highlights, h] }));
  },

  // ───────── Cognitive ─────────
  getCognitiveFlags: () => {
    const { ideas, relations } = useAppStore.getState();
    return analyzeIdeas(ideas, relations);
  },

  getStudyQueue: () => {
    const { ideas, relations } = useAppStore.getState();
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
}));
