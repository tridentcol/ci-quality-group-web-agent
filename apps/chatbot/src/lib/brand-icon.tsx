/**
 * Ícono de marca generado en tiempo de build/edge con next/og (ImageResponse), sin
 * archivos PNG binarios ni dependencias. Verde de marca (#15803d) con "CI" en blanco.
 * Lo usan las rutas /icon-192.png, /icon-512.png, /icon-maskable.png y app/apple-icon.
 */
export function brandIcon(size: number, opts: { rounded?: boolean; maskable?: boolean } = {}) {
  const { rounded = false, maskable = false } = opts;
  // En maskable el SO recorta los bordes → texto dentro de la "zona segura" (~80%).
  const fontSize = maskable ? size * 0.4 : size * 0.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#15803d",
        borderRadius: rounded ? size * 0.18 : 0,
      }}
    >
      <div style={{ fontSize, fontWeight: 800, color: "#ffffff", letterSpacing: -size * 0.015 }}>CI</div>
    </div>
  );
}
