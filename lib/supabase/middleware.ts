import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Refresca la sesión de Supabase y aplica la lista blanca: solo el correo de
 * ALLOWED_EMAIL puede entrar. Cualquier otro usuario se bloquea aunque logre
 * autenticarse con Google.
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
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase();

  // Usuario autenticado pero no autorizado -> cerrar sesión y bloquear.
  if (user && allowedEmail && user.email?.toLowerCase() !== allowedEmail) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no-autorizado");
    return NextResponse.redirect(url);
  }

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
