import React, { useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import type { Anchor } from "./domain/entities/Anchor";
import { NotesPanel } from "./ui/NotesPanel/NotesPanel";
import { PdfViewer } from "./ui/PdfViewer/PdfViewer";
import type { PdfViewerHandle } from "./ui/PdfViewer/PdfViewer";

import { Dashboard } from "./ui/Dashboard/Dashboard";
import "pdfjs-dist/web/pdf_viewer.css";

document.body.style.margin = "0";

/* ───────────────── Workspace ───────────────── */

function Workspace({ pdfUrl }: { pdfUrl: string }) {
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<Anchor | null>(null);

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <PdfViewer
        ref={pdfViewerRef}
        file={pdfUrl}
        onRequestComment={(anchor) => {
          setActiveAnchor(anchor);
          pdfViewerRef.current?.goToAnchor(anchor);
        }}
      />

      <NotesPanel
        activeAnchor={activeAnchor}
        onGoToAnchor={(anchor) => {
          pdfViewerRef.current?.goToAnchor(anchor);
        }}
      />
    </div>
  );
}

/* ───────────────── App ───────────────── */

function App() {
  const [view, setView] = useState<"dashboard" | "workspace">("dashboard");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  if (view === "dashboard") {
    return (
      <Dashboard
        onOpenPdf={(file) => {
          const url = URL.createObjectURL(file);
          setPdfUrl(url);
          setView("workspace");
        }}
      />
    );
  }

  if (!pdfUrl) return null;

  return <Workspace pdfUrl={pdfUrl} />;
}

/* ───────────────── Bootstrap ───────────────── */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
