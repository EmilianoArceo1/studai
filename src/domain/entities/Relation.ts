export type RelationType = "SUPPORTS" | "DEPENDS_ON" | "CONTRADICTS";

export interface Relation {
  relationId: string;
  projectId: string;

  fromIdeaId: string;
  toIdeaId: string;

  relationType: RelationType;
  justification?: string;

  createdAt: string;
}
