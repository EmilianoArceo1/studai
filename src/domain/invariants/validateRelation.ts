import type { Relation } from "../entities/Relation";

export function validateRelation(relation: Relation): void {
  if (relation.fromIdeaId === relation.toIdeaId) {
    throw new Error("Una idea no puede relacionarse consigo misma");
  }

  // ciclos de DEPENDS_ON se validarán después
}
