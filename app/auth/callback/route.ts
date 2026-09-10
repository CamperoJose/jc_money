import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CATEGORIAS_INICIALES = [
  ["Alimentación", "gasto"], ["Transporte", "gasto"], ["Salud", "gasto"], ["Servicios", "gasto"],
  ["Ocio", "gasto"], ["Trámites", "gasto"], ["Tecnología", "gasto"], ["Otros", "gasto"],
  ["Sueldo", "ingreso"], ["Rendimientos", "ingreso"], ["Otros", "ingreso"],
] as const;

/** Inicializa solo catálogos/configuración. Las cuentas las registra el usuario desde Parámetros. */
async function inicializarUsuario(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { count, error: eCat } = await supabase.from("categories").select("id", { count: "exact", head: true });
  if (!eCat && count === 0) {
    await supabase.from("categories").insert(CATEGORIAS_INICIALES.map(([name, kind]) => ({ name, kind, active: true })));
  }

  // El correo autenticado es el destinatario inicial de notificaciones. El usuario
  // puede cambiarlo posteriormente sin tocar SMTP_USER/SMTP_PASS del servidor.
  if (user.email) {
    const { data: setting } = await supabase.from("app_settings").select("id").eq("key", "email_destino").maybeSingle();
    if (!setting) await supabase.from("app_settings").insert({ key: "email_destino", value: user.email });
  }

  const { data: tc } = await supabase.from("app_settings").select("key").in("key", ["tc_cod_indicador", "tc_cod_moneda"]);
  const keys = new Set((tc ?? []).map(x => x.key));
  const defaults = [];
  if (!keys.has("tc_cod_indicador")) defaults.push({ key: "tc_cod_indicador", value: "1" });
  if (!keys.has("tc_cod_moneda")) defaults.push({ key: "tc_cod_moneda", value: "12" });
  if (defaults.length) await supabase.from("app_settings").insert(defaults);
}

/** Intercambia el código de OAuth por una sesión y redirige a la app. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tracking/patrimonio";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try { await inicializarUsuario(supabase); }
      catch (e) { console.error("[auth/callback] inicialización de usuario falló:", e); }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession falló:", error.message);
    const url = new URL(`${origin}/login`); url.searchParams.set("error", "auth"); url.searchParams.set("detalle", error.message); return NextResponse.redirect(url);
  }
  const errorDescription = searchParams.get("error_description");
  const url = new URL(`${origin}/login`); url.searchParams.set("error", "auth"); if (errorDescription) url.searchParams.set("detalle", errorDescription); return NextResponse.redirect(url);
}
