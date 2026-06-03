import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cqg/shared se distribuye como TS sin compilar; Next debe transpilarlo.
  transpilePackages: ["@cqg/shared"],
  // Permite cargar recursos /_next/ en dev al entrar por la IP de LAN (no solo localhost).
  // Solo afecta a desarrollo. Recomendado igualmente usar http://localhost:3000 para Clerk.
  allowedDevOrigins: ["172.20.10.5"],
};

export default nextConfig;
