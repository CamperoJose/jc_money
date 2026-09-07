import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Al volver atrás desde un detalle, la lista reaparecía arriba del todo
    // aunque estuvieras en la fila 40.
    scrollRestoration: true,
    // Tree-shaking dirigido: evita cargar el barrel completo de estas libs
    // (iconos y gráficos), lo que acelera mucho la compilación en dev y
    // reduce el bundle. Es la causa principal de la lentitud percibida.
    optimizePackageImports: ["@phosphor-icons/react", "recharts"],
  },
};

export default nextConfig;
