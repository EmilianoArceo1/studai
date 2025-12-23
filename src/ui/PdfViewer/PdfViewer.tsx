// components/pdf/PdfViewer.tsx
import "./pdfWorker";
import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PdfPage } from "./PdfPage";
import { useAppStore } from "../../app/store";

interface Props {
  file: string;
}

export function PdfViewer({ file }: Props) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scrollToPage, setScrollToPage] = useState<number | null>(null);

  const anchors = useAppStore((s) => s.anchors);
  const loadAnchors = useAppStore((s) => s.loadAnchors);
  const addAnchor = useAppStore((s) => s.addAnchor);
  const addHighlight = useAppStore((s) => s.addHighlight);

  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const loadedPdf = await pdfjsLib.getDocument(file).promise;
      if (!cancelled) setPdf(loadedPdf);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Load anchors for file
  useEffect(() => {
    loadAnchors();
  }, [file, loadAnchors]);

  // Scroll effect
  useEffect(() => {
    if (!scrollToPage) return;
    const el = pageRefs.current.get(scrollToPage);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToPage(null);
    }
  }, [scrollToPage]);

  const anchorsForFile = useMemo(
    () => anchors.filter((a) => a.sourceId === file),
    [anchors, file]
  );

  if (!pdf) return <div>Cargando PDF…</div>;

  return (
    <div
      style={{
        overflowY: "auto",
        height: "100vh",
        padding: 24,
        background: "#020617",
      }}
    >
      {Array.from({ length: pdf.numPages }, (_, i) => {
        const pageNumber = i + 1;

        return (
          <div
            key={pageNumber}
            ref={(el) => {
              if (el) pageRefs.current.set(pageNumber, el);
            }}
          >
            <PdfPage
              pdf={pdf}
              pageNumber={pageNumber}
              anchors={anchorsForFile}
              onHighlight={({ quote, pageNumber, rects }) => {
                const anchorId = crypto.randomUUID();

                const anchor = {
                  anchorId,
                  projectId: "demo-project",
                  sourceId: file,
                  pageNumber,
                  quote,
                  rects,
                  resolverStrategy: "QUOTE_CONTEXT",
                  resolverConfidence: 1,
                  createdAt: new Date().toISOString(),
                };

                addAnchor(anchor);
                addHighlight({
                  highlightId: crypto.randomUUID(),
                  anchorId,
                  color: "#fde047",
                  createdAt: new Date().toISOString(),
                });

                // ✅ navegación explícita
                setScrollToPage(pageNumber);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
