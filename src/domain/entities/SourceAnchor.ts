export interface SourceAnchor {
  anchorId: string;
  projectId: string;
  sourceId: string;

  pageNumber: number;
  quote: string;

  contextBefore?: string;
  contextAfter?: string;

  selectionHint?: string;
  positionHint?: string;

  resolverStrategy: "QUOTE_CONTEXT";
  resolverConfidence: number;

  createdAt: string;
}
