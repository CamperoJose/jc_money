import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarSolicitudVoz } from "@/lib/voz/proceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64 = 12_000_000; // ~9 MB de audio

/**
 * Ingesta de audio para registro por voz. Responde de inmediato ("registro
 * recibido") y procesa en segundo plano (after): interpreta con Gemini, registra
 * gastos/deudas y envía un correo (recibo o alerta). Autentica por:
 *   - sesión web (app), o
 *   - `Authorization: Bearer <token>` contra api_ingest_tokens (Shortcut iOS).
 */
export async function POST(request: Request) {
  let payload: { audioBase64?: string; mimeType?: string; origen?: string };
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

  const admin = createAdminClient();

  // 1) Autenticación: sesión web o bearer token.
  let userId: string | null = null;
  let origen = payload.origen === "shortcut" ? "shortcut" : "app";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    userId = user.id;
  } else {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (token) {
      const { data } = await admin
        .from("api_ingest_tokens")
        .select("user_id")
        .eq("token", token)
        .limit(1);
      userId = (data?.[0] as { user_id: string } | undefined)?.user_id ?? null;
      origen = "shortcut";
    }
  }
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // 2) Fila de auditoría (procesando).
  const { data: reqRow, error: eIns } = await admin
    .from("ai_requests")
    .insert({ user_id: userId, origen, status: "procesando", audio_mime: mimeType })
    .select("id")
    .single();
  if (eIns) {
    return NextResponse.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
  }
  const requestId = reqRow.id as string;

  // 3) Procesa en segundo plano y actualiza la fila.
  const uid = userId;
  after(async () => {
    const r = await procesarSolicitudVoz(admin, { userId: uid, audioBase64, mimeType });
    await admin
      .from("ai_requests")
      .update({
        status: r.status,
        processed_at: new Date().toISOString(),
        transcripcion: r.transcripcion,
        n_gastos: r.nGastos,
        n_deudas: r.nDeudas,
        resumen: r.resumen,
        detalle: r.detalle,
        error: r.error,
        correo_ok: r.correoOk,
      })
      .eq("id", requestId);
  });

  // 4) Respuesta inmediata.
  return NextResponse.json(
    { ok: true, requestId, message: "Registro recibido. Te enviaremos un correo con el detalle." },
    { status: 202 }
  );
}
