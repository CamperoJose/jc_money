import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El registro de gasto por voz y otras rutas server usan Node APIs.
  experimental: {},
};

export default nextConfig;
