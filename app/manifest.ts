import type { MetadataRoute } from "next";

/** Manifest PWA: permite "Agregar a inicio" y abrir en modo app (standalone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyMoney",
    short_name: "MyMoney",
    description: "Gestión personal de finanzas e inversiones",
    start_url: "/tracking/patrimonio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f0",
    theme_color: "#12833b",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
