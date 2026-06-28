// Página de respaldo cuando no hay conexión (la sirve el service worker). Usa estilos
// en línea para verse bien aunque el CSS del build no esté en caché.
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        background: "#F8FAFC",
        color: "#0F172A",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "#15803d",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 24,
        }}
      >
        CI
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Sin conexión</h1>
      <p style={{ fontSize: 14, color: "#64748B", maxWidth: 360, margin: 0 }}>
        No hay internet en este momento. Revisa tu conexión y vuelve a intentar; el panel se
        recargará automáticamente cuando vuelva.
      </p>
    </div>
  );
}
