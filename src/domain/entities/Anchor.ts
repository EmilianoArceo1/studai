// domain/entities/Anchor.ts

export interface Anchor {
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
  rects: Anchor[];

  resolverStrategy: string;
  resolverConfidence: number;
  createdAt: string;
}

