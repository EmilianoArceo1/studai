import Dexie from "dexie";
import type { Table } from "dexie";

import type { Idea } from "../domain/entities/Idea";
import type { Anchor } from "../domain/entities/Anchor";
import type { Relation } from "../domain/entities/Relation";
import type { IdeaAnchor } from "../domain/entities/IdeaAnchor";
import type { Highlight } from "../domain/entities/Highlight";

export class StudAIDatabase extends Dexie {
  ideas!: Table<Idea>;
  anchors!: Table<Anchor>;
  relations!: Table<Relation>;
  ideaAnchors!: Table<IdeaAnchor>;
  highlights!: Table<Highlight>;

  constructor() {
    super("studai-db");

    // ⬆️ SUBIMOS VERSION (rompe compatibilidad a propósito)
    this.version(7).stores({
  ideas: "ideaId, projectId, anchorId, hiddenFromNotes",
  


      /**
       * Anchor real del dominio
       * rects se serializa como JSON (Dexie lo soporta)
       */
      anchors: "anchorId, projectId, sourceId, pageNumber",

      ideaAnchors: "ideaAnchorId, ideaId, anchorId",
      relations: "relationId, projectId",
      highlights: "highlightId, anchorId",
    });
  }
}

export const db = new StudAIDatabase();
