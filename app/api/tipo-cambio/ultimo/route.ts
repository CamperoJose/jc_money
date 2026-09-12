import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTcConfig, getUltimoTc } from "@/lib/queries/tc";

export const dynamic = "force-dynamic";

/**
 * Último T/C registrado en o antes de ?date=YYYY-MM-DD para el indicador y
 * moneda configurados. Usado para prellenar el T/C de un movimiento o foto.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parámetro date inválido (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const cfg = await getTcConfig(supabase);
    const rate = await getUltimoTc(supabase, date, cfg.cod_moneda, undefined, cfg.cod_indicador);
    return NextResponse.json({ rate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
