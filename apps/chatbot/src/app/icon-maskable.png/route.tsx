import { ImageResponse } from "next/og";
import { brandIcon } from "@/lib/brand-icon";

// Maskable: fondo a sangre (sin esquinas redondeadas) y texto en la zona segura.
export function GET() {
  return new ImageResponse(brandIcon(512, { maskable: true }), { width: 512, height: 512 });
}
