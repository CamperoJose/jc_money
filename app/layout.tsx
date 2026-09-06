import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/pwa/registrar-sw";

// Fuentes autoalojadas por Next: sin petición a fonts.googleapis.com, sin salto
// de maquetación al cargar y sin depender de un tercero para que la app se vea
// bien. Exponen variables CSS que globals.css usa en --font-sans / --font-mono.
const geistSans = Geist({ subsets: ["latin"], variable: "--fuente-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--fuente-mono", display: "swap" });

export const metadata: Metadata = {
  title: "MyMoney",
  description: "Gestión personal de finanzas e inversiones",
  applicationName: "MyMoney",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MyMoney",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Aplica el tema ANTES de pintar para evitar el flash (FOUC). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mymoney.theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-background antialiased">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
