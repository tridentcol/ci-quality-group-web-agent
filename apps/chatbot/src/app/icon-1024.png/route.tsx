import { ImageResponse } from "next/og";
import { brandIcon } from "@/lib/brand-icon";

// Ícono 1024×1024 para subir a Meta (App Review → Configuración → Ícono de la app).
// Cuadrado lleno sin redondear: Meta aplica su propia máscara. Descárgalo abriendo
// https://bot.ci-quality-group.com/icon-1024.png y "Guardar imagen como…".
export function GET() {
  return new ImageResponse(brandIcon(1024, { rounded: false }), { width: 1024, height: 1024 });
}
