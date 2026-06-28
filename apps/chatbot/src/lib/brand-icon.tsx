/**
 * Ícono de marca generado con next/og (ImageResponse), sin archivos PNG binarios.
 * Un robot dentro de una burbuja de chat (asistente conversacional): burbuja blanca
 * con ojos y sonrisa en verde de marca (#15803d), antena arriba y colita de burbuja
 * abajo. El arte es un SVG vectorial que se incrusta como <img> y Satori rasteriza,
 * así que se ve nítido en cualquier tamaño.
 * Lo usan las rutas /icon-192.png, /icon-512.png, /icon-1024.png, /icon-maskable.png
 * y app/apple-icon.
 */

// Arte del robot: blanco sobre transparente; ojos/boca en verde para que "calen"
// con el fondo. viewBox 0 0 100 100.
const ROBOT_ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
<circle cx="50" cy="9" r="4.5" fill="#ffffff"/>
<rect x="47.25" y="10" width="5.5" height="12" rx="2.75" fill="#ffffff"/>
<rect x="14" y="21" width="72" height="52" rx="16" fill="#ffffff"/>
<polygon points="33,69 33,86 49,69" fill="#ffffff"/>
<circle cx="39" cy="44" r="6" fill="#15803d"/>
<circle cx="61" cy="44" r="6" fill="#15803d"/>
<path d="M37 56 Q50 66 63 56" stroke="#15803d" stroke-width="5.5" stroke-linecap="round" fill="none"/>
</svg>`;

const ROBOT_DATA_URI = `data:image/svg+xml;base64,${btoa(ROBOT_ART)}`;

export function brandIcon(size: number, opts: { rounded?: boolean; maskable?: boolean } = {}) {
  const { rounded = false, maskable = false } = opts;
  // En maskable el SO recorta los bordes → arte dentro de la "zona segura" (~62%).
  const art = Math.round(size * (maskable ? 0.62 : 0.82));
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width={art} height={art} src={ROBOT_DATA_URI} alt="" />
    </div>
  );
}
