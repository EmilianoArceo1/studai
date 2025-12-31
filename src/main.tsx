import React, { useRef, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import type { Anchor } from "./domain/entities/Anchor";
import { NotesPanel } from "./ui/NotesPanel/NotesPanel";
import { PdfViewer } from "./ui/PdfViewer/PdfViewer";
import type { PdfViewerHandle } from "./ui/PdfViewer/PdfViewer";
import { Dashboard } from "./ui/Dashboard/Dashboard";
import "pdfjs-dist/web/pdf_viewer.css";

// Icons (puedes usar una librería como react-icons en producción)
const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="10" width="7" height="11" rx="1" />
    </svg>
  ),
  Book: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  ),
  Download: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Search: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Logout: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

document.body.style.margin = "0";

/* ───────────────── Navbar Component ───────────────── */
function Navbar({
  currentView,
  onToggleView,
  onLogout,
  pdfUrl,
  onExport,
  onSearch,
  userName = "Usuario",
}: {
  currentView: "dashboard" | "workspace";
  onToggleView: () => void;
  onLogout: () => void;
  pdfUrl: string | null;
  onExport: () => void;
  onSearch: (query: string) => void;
  userName?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(3); // Ejemplo de notificaciones

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <nav style={{
      height: "64px",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      backdropFilter: "blur(10px)",
    }}>
      {/* Left Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* Logo/App Name */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
        }} onClick={onToggleView}>
          <div style={{
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Icons.Book />
          </div>
          <span style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#f8fafc",
            letterSpacing: "-0.5px",
          }}>
            PDF Analyzer Pro
          </span>
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onToggleView}
            style={{
              padding: "8px 16px",
              background: currentView === "dashboard" 
                ? "rgba(59, 130, 246, 0.2)" 
                : "transparent",
              color: currentView === "dashboard" ? "#3b82f6" : "#94a3b8",
              border: `1px solid ${currentView === "dashboard" ? "#3b82f6" : "rgba(148, 163, 184, 0.2)"}`,
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (currentView !== "dashboard") {
                e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
                e.currentTarget.style.color = "#e2e8f0";
              }
            }}
            onMouseLeave={(e) => {
              if (currentView !== "dashboard") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }
            }}
          >
            <Icons.Dashboard />
            Dashboard
          </button>

          {currentView === "workspace" && (
            <button
              onClick={onExport}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              <Icons.Download />
              Exportar Notas
            </button>
          )}
        </div>
      </div>

      {/* Center Section - Search */}
      {currentView === "workspace" && (
        <div style={{ flex: 1, maxWidth: "480px", margin: "0 32px" }}>
          <form onSubmit={handleSearch} style={{ position: "relative" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en documento y notas..."
              style={{
                width: "100%",
                padding: "12px 20px 12px 44px",
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                borderRadius: "10px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(15, 23, 42, 0.9)";
                e.target.style.borderColor = "#3b82f6";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(15, 23, 42, 0.7)";
                e.target.style.borderColor = "rgba(148, 163, 184, 0.2)";
              }}
            />
            <div style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#64748b",
            }}>
              <Icons.Search />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            )}
          </form>
        </div>
      )}

      {/* Right Section - User Menu */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Notifications */}
        <button
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "8px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
            e.currentTarget.style.color = "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#94a3b8";
          }}
        >
          <Icons.Bell />
          {notifications > 0 && (
            <span style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "#ef4444",
              color: "white",
              fontSize: "10px",
              fontWeight: "600",
              minWidth: "16px",
              height: "16px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}>
              {notifications}
            </span>
          )}
        </button>

        {/* User Profile */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "transparent",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "10px",
              padding: "8px 12px",
              color: "#e2e8f0",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
            }}
            onMouseLeave={(e) => {
              if (!userMenuOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.2)";
              }
            }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "600",
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "14px", fontWeight: "600" }}>{userName}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Usuario Premium</div>
            </div>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#1e293b",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "10px",
              minWidth: "200px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
              zIndex: 1001,
              overflow: "hidden",
            }}>
              <div style={{ padding: "16px", borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
                <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>{userName}</div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>usuario@ejemplo.com</div>
              </div>
              
              <button
                onClick={() => {
                  // Settings functionality
                  setUserMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#e2e8f0",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Icons.Settings />
                Configuración
              </button>
              
              <button
                onClick={() => {
                  onLogout();
                  setUserMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Icons.Logout />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Close user menu when clicking outside */}
      {userMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </nav>
  );
}

/* ───────────────── Workspace ───────────────── */
function Workspace({ pdfUrl }: { pdfUrl: string }) {
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<Anchor | null>(null);
  const [leftWidth, setLeftWidth] = useState(720);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const MIN_LEFT = 420;
  const MIN_RIGHT = 360;

  const onMouseDown = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onMouseUp = () => {
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newLeft = e.clientX - rect.left;
    const maxLeft = rect.width - MIN_RIGHT;
    
    if (newLeft >= MIN_LEFT && newLeft <= maxLeft) {
      setLeftWidth(newLeft);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Navbar will be added in App component */}
      
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          background: "#020617",
        }}
      >
        {/* PDF Section */}
        <div
          style={{
            width: leftWidth,
            minWidth: MIN_LEFT,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
            background: "rgba(2, 6, 23, 0.8)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  color: "#f8fafc",
                  fontSize: "16px",
                  fontWeight: "600",
                }}>
                  Documento PDF
                </h3>
                <p style={{
                  margin: "4px 0 0",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}>
                  Selecciona texto para comentar o subrayar
                </p>
              </div>
              <div style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}>
                <span style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  padding: "4px 12px",
                  background: "rgba(148, 163, 184, 0.1)",
                  borderRadius: "6px",
                }}>
                  Vista de lectura
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: "hidden" }}>
            <PdfViewer
              ref={pdfViewerRef}
              file={pdfUrl}
              onRequestComment={(anchor) => {
                setActiveAnchor(anchor);
                pdfViewerRef.current?.goToAnchor(anchor);
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: "6px",
            cursor: "col-resize",
            background: "rgba(148, 163, 184, 0.15)",
            transition: "background 120ms",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(249, 115, 22, 0.45)";
          }}
          onMouseLeave={(e) => {
            if (!draggingRef.current) {
              e.currentTarget.style.background = "rgba(148, 163, 184, 0.15)";
            }
          }}
        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "2px",
            height: "40px",
            background: "rgba(148, 163, 184, 0.3)",
            borderRadius: "1px",
          }} />
        </div>

        {/* Notes Section */}
        <div
          style={{
            flex: 1,
            minWidth: MIN_RIGHT,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
            background: "rgba(2, 6, 23, 0.8)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  color: "#f8fafc",
                  fontSize: "16px",
                  fontWeight: "600",
                }}>
                  Notas y Comentarios
                </h3>
                <p style={{
                  margin: "4px 0 0",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}>
                  {activeAnchor 
                    ? `Editando comentario sobre: "${activeAnchor.quote.substring(0, 60)}..."`
                    : "Tus anotaciones aparecerán aquí"}
                </p>
              </div>
              <div style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}>
                <span style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  padding: "4px 12px",
                  background: "rgba(148, 163, 184, 0.1)",
                  borderRadius: "6px",
                }}>
                  {activeAnchor ? "Modo edición" : "Modo vista"}
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NotesPanel
              activeAnchor={activeAnchor}
              onGoToAnchor={(anchor) => {
                pdfViewerRef.current?.goToAnchor(anchor);
              }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        height: "32px",
        background: "rgba(2, 6, 23, 0.95)",
        borderTop: "1px solid rgba(148, 163, 184, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        fontSize: "12px",
        color: "#94a3b8",
      }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <span>Documento activo: {pdfUrl.split('/').pop()}</span>
          <span>Anotaciones: 0 sin guardar</span>
          <span>Auto-guardado: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <span>Zoom: 100%</span>
          <span>Página: 1 de 10</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── App ───────────────── */
function App() {
  const [view, setView] = useState<"dashboard" | "workspace">("dashboard");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [userName] = useState("Alex Johnson");

  const handleOpenPdf = (file: File) => {
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setView("workspace");
  };

  const handleExport = () => {
    // Implement export functionality
    alert("Exportando notas...");
  };

  const handleSearch = (query: string) => {
    // Implement search functionality
    console.log("Searching for:", query);
  };

  const handleLogout = () => {
    setView("dashboard");
    setPdfUrl(null);
    alert("Sesión cerrada");
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      {view === "workspace" && pdfUrl && (
        <>
          <Navbar
            currentView={view}
            onToggleView={() => setView("dashboard")}
            onLogout={handleLogout}
            pdfUrl={pdfUrl}
            onExport={handleExport}
            onSearch={handleSearch}
            userName={userName}
          />
          <Workspace pdfUrl={pdfUrl} />
        </>
      )}
      
      {view === "dashboard" && (
        <div style={{ height: "100vh" }}>
          <Navbar
            currentView={view}
            onToggleView={() => {}} // No effect on dashboard
            onLogout={handleLogout}
            pdfUrl={null}
            onExport={handleExport}
            onSearch={handleSearch}
            userName={userName}
          />
          <Dashboard onOpenPdf={handleOpenPdf} />
        </div>
      )}
    </div>
  );
}

/* ───────────────── Bootstrap ───────────────── */
const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}