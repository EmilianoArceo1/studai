import type { Idea } from "../entities/Idea";
import type { Relation } from "../entities/Relation";
import type { CognitiveFlag } from "../enums/CognitiveFlag";

export function analyzeIdeas(
  ideas: Idea[],
  relations: Relation[]
): Map<string, CognitiveFlag[]> {
  const result = new Map<string, CognitiveFlag[]>();

  const relationsByIdea = new Map<string, Relation[]>();
  relations.forEach((r) => {
    relationsByIdea.set(r.fromIdeaId, [
      ...(relationsByIdea.get(r.fromIdeaId) ?? []),
      r,
    ]);
    relationsByIdea.set(r.toIdeaId, [
      ...(relationsByIdea.get(r.toIdeaId) ?? []),
      r,
    ]);
  });

  for (const idea of ideas) {
    const flags: CognitiveFlag[] = [];
    const rels = relationsByIdea.get(idea.ideaId) ?? [];

    // 1️⃣ Idea aislada
    if (rels.length === 0) {
      flags.push("ISOLATED");
    }

    // 2️⃣ Afirmación sin evidencia
    if (idea.type === "CLAIM") {
      const hasEvidence = rels.some(
        (r) =>
          r.relationType === "SUPPORTS" &&
          r.toIdeaId === idea.ideaId
      );
      if (!hasEvidence) flags.push("NO_EVIDENCE");
    }

    // 3️⃣ Contradicción no resuelta
const contradictionRelations = rels.filter(
  (r) => r.relationType === "CONTRADICTS"
);

if (contradictionRelations.length > 0) {
  const hasResolution = rels.some(
    (r) =>
      r.relationType === "SUPPORTS" &&
      r.toIdeaId === idea.ideaId
  );

  if (!hasResolution) {
    flags.push("UNRESOLVED_CONTRADICTION");
  }
}


    if (flags.length > 0) result.set(idea.ideaId, flags);
  }

  return result;
}
