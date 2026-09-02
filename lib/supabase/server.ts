import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Sesiones largas: las cookies de sesión persisten ~90 días (el refresh token
// se rota solo mientras la sesión siga activa dentro de ese periodo).
const NOVENTA_DIAS = 60 * 60 * 24 * 90;
function conMaxAgeLargo(options: CookieOptions): CookieOptions {
  return { ...options, maxAge: NOVENTA_DIAS };
}

/**
 * Cliente de Supabase para el servidor (Route Handlers, Server Components,
 * Server Actions). Usa las cookies de la sesión del usuario, de modo que el
 * RLS aplica con `auth.uid()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, conMaxAgeLargo(options))
            );
          } catch {
            // Llamado desde un Server Component: lo maneja el middleware.
          }
        },
      },
    }
  );
}
