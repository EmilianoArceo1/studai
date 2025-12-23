import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { v4 as uuid } from "uuid";

import { NotesPanel } from "./ui/NotesPanel/NotesPanel";
import {  PdfViewer } from "./ui/PdfViewer/PdfViewer";

import { Dashboard } from "./ui/Dashboard/Dashboard";
import { useAppStore } from "./app/store";

document.body.style.margin = "0";

function Workspace({ pdfUrl }: { pdfUrl: string }) {
  const addAnchor = useAppStore((s) => s.addAnchor);

  // 🔑 ESTE estado faltaba
  const [goToPage, setGoToPage] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <PdfViewer
        file={pdfUrl}
        scrollToPage={goToPage}
        onSelectText={({ quote, pageNumber }) => {
          addAnchor({
            anchorId: uuid(),
            projectId: "demo-project",
            sourceId: pdfUrl, // temporal
            pageNumber,
            quote,
            resolverStrategy: "QUOTE_CONTEXT",
            resolverConfidence: 0.9,
            createdAt: new Date().toISOString(),
          });
        }}
      />

      <NotesPanel
        onGoToPage={(pageNumber) => {
          setGoToPage(null);
          setTimeout(() => setGoToPage(pageNumber), 0);
        }}

      />
    </div>
  );
}

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
