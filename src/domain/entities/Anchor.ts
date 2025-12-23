// domain/entities/Anchor.ts

export interface AnchorRect {
  /** Normalizado respecto al viewport (0–1) */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Anchor {
  anchorId: string;
  projectId: string;
  sourceId: string;
  pageNumber: number;
  quote: string;

  /** Rects NORMALIZADOS */
  rects: AnchorRect[];

  resolverStrategy: string;
  resolverConfidence: number;
  createdAt: string;
}

