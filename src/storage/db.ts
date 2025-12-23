import Dexie from "dexie";
import type { Table } from "dexie";
import type { Idea } from "../domain/entities/Idea";
import type { SourceAnchor } from "../domain/entities/SourceAnchor";
import type { Relation } from "../domain/entities/Relation";
import type { IdeaAnchor } from "../domain/entities/IdeaAnchor";
import type { Highlight } from "../domain/entities/Highlight";

export class StudAIDatabase extends Dexie {
  ideas!: Table<Idea>;
  anchors!: Table<SourceAnchor>;
  relations!: Table<Relation>;
  ideaAnchors!: Table<IdeaAnchor>;
  highlights!: Table<Highlight>;

  constructor() {
    super("studai-db");

    // ⬆️ SUBIMOS VERSION
    this.version(6).stores({
      ideas: "ideaId, projectId",
      // 👇 rects NO es índice, pero ahora Dexie lo serializa bien
      anchors: "anchorId, projectId, pageNumber",
      ideaAnchors: "ideaAnchorId, ideaId, anchorId",
      relations: "relationId, projectId",
      highlights: "highlightId, anchorId",
    });
  }
}

export const db = new StudAIDatabase();
