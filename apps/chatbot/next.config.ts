import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cqg/shared se distribuye como TS sin compilar; Next debe transpilarlo.
  transpilePackages: ["@cqg/shared"],
  // Parsers de ingesta (officeparser, mammoth). No los empaquetes: cárgalos desde
  // node_modules en runtime. El PDF lo hace `unpdf` (pdf.js para serverless, sin
  // binarios nativos) → ya no necesitamos pdf-parse ni @napi-rs/canvas.
  serverExternalPackages: ["officeparser", "mammoth"],
  // Permite cargar recursos /_next/ en dev al entrar por la IP de LAN (no solo localhost).
  // Solo afecta a desarrollo. Recomendado igualmente usar http://localhost:3000 para Clerk.
  allowedDevOrigins: ["172.20.10.5"],
  // Cabeceras de seguridad básicas para todo el sitio (panel de admin con datos de
  // clientes). Sin CSP: el panel usa Clerk + varios scripts de terceros y no hay
  // forma de probar interactivamente una CSP estricta sin riesgo de romper algo.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
