import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Intercambia el código de OAuth por una sesión y redirige a la app. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tracking/patrimonio";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession falló:", error.message);
    const url = new URL(`${origin}/login`);
    url.searchParams.set("error", "auth");
    url.searchParams.set("detalle", error.message);
    return NextResponse.redirect(url);
  }

  const errorDescription = searchParams.get("error_description");
  const url = new URL(`${origin}/login`);
  url.searchParams.set("error", "auth");
  if (errorDescription) url.searchParams.set("detalle", errorDescription);
  return NextResponse.redirect(url);
}
