import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cqg/shared se distribuye como TS sin compilar; Next debe transpilarlo.
  transpilePackages: ["@cqg/shared"],
};

export default nextConfig;
