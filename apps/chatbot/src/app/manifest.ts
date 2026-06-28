import type { MetadataRoute } from "next";

// Web App Manifest (instalable). Next sirve esto en /manifest.webmanifest y agrega
// <link rel="manifest"> automáticamente. Ruta pública (no la bloquea Clerk).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CI Quality Group — Panel",
    short_name: "CQG Panel",
    description: "Panel del asistente de atención de CI Quality Group.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F8FAFC",
    theme_color: "#15803d",
    lang: "es-CO",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
