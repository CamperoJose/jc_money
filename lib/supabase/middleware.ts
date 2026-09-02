import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Sesiones largas (~90 días): persistimos las cookies de sesión ese periodo.
const NOVENTA_DIAS = 60 * 60 * 24 * 90;

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Refresca la sesión de Supabase y protege las rutas privadas: sin sesión, a
 * /login. No hay lista blanca por correo; el aislamiento de datos lo da RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, maxAge: NOVENTA_DIAS })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // (Se removió la lista blanca por correo: cualquier usuario autenticado con
  // Google puede acceder. El control de acceso a datos sigue por RLS.)

  // Sin sesión en ruta protegida -> a login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión visitando /login -> a la app.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/tracking/patrimonio";
    return NextResponse.redirect(url);
  }

  return response;
}
