import type { Idea } from "../entities/Idea";
import { IdeaOrigin } from "../enums/IdeaOrigin";


export function validateIdea(idea: Idea): void {
  if (idea.rephrase.trim().length < 10) {
    throw new Error("Idea.rephrase debe tener al menos 10 caracteres");
  }

  if (idea.origin !== IdeaOrigin.MANUAL && !idea.anchorId) {
    throw new Error("Idea con origen no manual requiere anchorId");
  }

  if (idea.confidence < 0 || idea.confidence > 1) {
    throw new Error("confidence debe estar entre 0 y 1");
  }
}
