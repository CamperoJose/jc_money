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
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/ingesta|api/respaldo|api/recordatorios|api/estado).*)",
  ],
};
