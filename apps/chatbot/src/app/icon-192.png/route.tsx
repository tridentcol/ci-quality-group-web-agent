import { ImageResponse } from "next/og";
import { brandIcon } from "@/lib/brand-icon";

export function GET() {
  return new ImageResponse(brandIcon(192, { rounded: true }), { width: 192, height: 192 });
}
