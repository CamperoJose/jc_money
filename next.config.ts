import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shaking dirigido: evita cargar el barrel completo de estas libs
    // (iconos y gráficos), lo que acelera mucho la compilación en dev y
    // reduce el bundle. Es la causa principal de la lentitud percibida.
    optimizePackageImports: ["@phosphor-icons/react", "recharts"],
  },
};

export default nextConfig;
