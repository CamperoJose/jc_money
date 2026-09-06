import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto assets estáticos y la API con token Bearer
     * (esa se protege por su cuenta).
     * `sw.js` y `manifest.webmanifest` DEBEN quedar fuera: si el middleware los
     * redirige a /login, el navegador recibe HTML donde espera un script o un
     * JSON y el service worker no llega a registrarse.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/voz/ingesta|api/ingesta|api/respaldo|api/recordatorios|api/estado|api/jobs).*)",
  ],
};
