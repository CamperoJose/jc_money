import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copiarPresupuestos } from "@/lib/mutations/presupuestos";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { desde?: string; hacia?: string };
  try {
    body = (await request.json()) as { desde?: string; hacia?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { desde, hacia } = body;
  if (!desde || !hacia || !/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hacia)) {
    return NextResponse.json({ error: "Periodos inválidos (YYYY-MM)." }, { status: 400 });
  }
  try {
    const copiados = await copiarPresupuestos(supabase, desde, hacia);
    return NextResponse.json({ copiados });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al copiar" }, { status: 500 });
  }
}
