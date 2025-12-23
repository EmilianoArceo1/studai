interface Props {
  onOpenPdf: () => void;
}

export function Dashboard({ onOpenPdf }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a", // slate-900
        color: "#e5e7eb", // gray-200
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: 520,
          padding: "48px 56px",
          background: "#020617", // slate-950
          borderRadius: 12,
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            StudAI
          </h1>
          <p
            style={{
              margin: 0,
              color: "#9ca3af", // gray-400
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Estudio profundo a partir de fuentes reales.
            <br />
            Lee, ancla, conecta y entiende.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          id="pdf-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onOpenPdf(file);
          }}
        />

        <label
          htmlFor="pdf-input"
          style={{
            padding: "14px 18px",
            fontSize: 15,
            fontWeight: 500,
            borderRadius: 8,
            cursor: "pointer",
            background: "#2563eb",
            color: "white",
            textAlign: "left",
            display: "block",
          }}
        >
          📄 Abrir PDF
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              marginTop: 4,
            }}
          >
            Cargar un documento y comenzar a trabajar
          </div>
        </label>


          <button
            disabled
            style={{
              padding: "14px 18px",
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid #1e293b",
              background: "transparent",
              color: "#9ca3af",
              textAlign: "left",
              cursor: "not-allowed",
            }}
          >
            🧠 Modo Estudio
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              Revisión guiada por indicadores cognitivos
            </div>
          </button>

          <button
            disabled
            style={{
              padding: "14px 18px",
              fontSize: 15,
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid #1e293b",
              background: "transparent",
              color: "#9ca3af",
              textAlign: "left",
              cursor: "not-allowed",
            }}
          >
            🗂️ Proyectos
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              Organiza tu trabajo por investigaciones
            </div>
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          Diseñado para pensamiento crítico, no para tomar notas rápidas.
        </div>
      </div>
    </div>
  );
}
