/// <reference types="vite/client" />

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  export function renderTextLayer(params: {
    textContent: any;
    container: HTMLElement;
    viewport: any;
    textDivs: HTMLElement[];
  }): void;
}

