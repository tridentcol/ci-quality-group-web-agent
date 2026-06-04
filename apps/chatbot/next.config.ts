import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cqg/shared se distribuye como TS sin compilar; Next debe transpilarlo.
  transpilePackages: ["@cqg/shared"],
  // Parsers de ingesta con dependencias NATIVAS (pdf-parse→pdf.js→@napi-rs/canvas,
  // officeparser). No los empaquetes: cárgalos desde node_modules en runtime para
  // que Vercel incluya los binarios correctos del lambda. Sin esto, /api/inngest
  // (que los importa vía ingest-source) falla al cargar en producción (500).
  serverExternalPackages: ["pdf-parse", "officeparser", "mammoth", "@napi-rs/canvas"],
  // Permite cargar recursos /_next/ en dev al entrar por la IP de LAN (no solo localhost).
  // Solo afecta a desarrollo. Recomendado igualmente usar http://localhost:3000 para Clerk.
  allowedDevOrigins: ["172.20.10.5"],
};

export default nextConfig;
