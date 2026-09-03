import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCuentas } from "@/lib/queries/patrimonio";
import { getCategorias } from "@/lib/queries/gastos";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { interpretarAudio } from "@/lib/voz/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64 = 12_000_000; // ~9 MB de audio; recorte de seguridad

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let payload: { audioBase64?: string; mimeType?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const audioBase64 = (payload.audioBase64 ?? "").replace(/^data:[^,]*,/, "");
  const mimeType = payload.mimeType || "audio/webm";
  if (!audioBase64) return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  if (audioBase64.length > MAX_BASE64) {
    return NextResponse.json({ error: "El audio es demasiado largo." }, { status: 413 });
  }

  try {
    const [cuentas, categorias] = await Promise.all([
      getCuentas(supabase),
      getCategorias(supabase, "gasto"),
    ]);
    const resultado = await interpretarAudio({
      audioBase64,
      mimeType,
      hoy: fechaBoliviaHoy(),
      cuentas: cuentas
        .filter((c) => c.active)
        .map((c) => ({ id: c.id, name: c.name, type: c.type, currency: c.currency })),
      categorias: categorias.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })),
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al interpretar el audio." },
      { status: 502 }
    );
  }
}
