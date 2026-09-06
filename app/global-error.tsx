"use client";

// Último recurso: se usa si falla el propio layout raíz, donde ya no existe
// ningún estilo ni proveedor de la app. Por eso lleva sus propios estilos en
// línea y su propio <html>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#ffffff",
          color: "#111827",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            MyMoney no pudo iniciar
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#4b5563", margin: "0 0 1rem" }}>
            Ocurrió un error antes de poder mostrar la aplicación. Tus datos están
            a salvo.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#6b7280" }}>
              Referencia: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#1e3a8a",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
