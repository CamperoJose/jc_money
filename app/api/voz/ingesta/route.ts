import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarSolicitudVoz } from "@/lib/voz/proceso";
import { verificarLimiteVoz } from "@/lib/voz/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BASE64 = 12_000_000;

function normalizarMime(mimeType: string): string {
  const mime = mimeType.trim().toLowerCase().split(";")[0];
  const aliases: Record<string, string> = {
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
  };
  return aliases[mime] ?? mime;
}

export async function POST(request: Request) {
  let payload: { audioBase64?: string; mimeType?: string; origen?: string; token?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const audioBase64 = (payload.audioBase64 ?? "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  const mimeType = normalizarMime(payload.mimeType || "audio/webm");
  if (!audioBase64) return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  if (audioBase64.length > MAX_BASE64) return NextResponse.json({ error: "El audio es demasiado largo." }, { status: 413 });

  const admin = createAdminClient();
  let userId: string | null = null;
  let origen = payload.origen === "shortcut" ? "shortcut" : "app";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userId = user.id;
  } else {
    const auth = request.headers.get("authorization") ?? "";
    let token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) token = request.headers.get("x-api-token")?.trim() || "";
    if (!token) token = (payload.token ?? "").trim();
    if (token) {
      const { data } = await admin.from("api_ingest_tokens").select("user_id").eq("token", token).limit(1);
      userId = (data?.[0] as { user_id: string } | undefined)?.user_id ?? null;
      origen = "shortcut";
    }
  }
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const limite = await verificarLimiteVoz(admin, userId);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: limite.motivo ?? "Demasiadas solicitudes." },
      { status: 429, headers: { "Retry-After": String(limite.reintentarEn ?? 60) } }
    );
  }

  const { data: reqRow, error: eIns } = await admin
    .from("ai_requests")
    .insert({ user_id: userId, origen, status: "procesando", audio_mime: mimeType })
    .select("id")
    .single();
  if (eIns) return NextResponse.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
  const requestId = reqRow.id as string;

  const uid = userId;
  after(async () => {
    const r = await procesarSolicitudVoz(admin, { userId: uid, audioBase64, mimeType });
    await admin.from("ai_requests").update({
      status: r.status,
      processed_at: new Date().toISOString(),
      transcripcion: r.transcripcion,
      n_gastos: r.nGastos,
      n_ingresos: r.nIngresos,
      n_deudas: r.nDeudas,
      resumen: r.resumen,
      detalle: r.detalle,
      error: r.error,
      correo_ok: r.correoOk,
    }).eq("id", requestId).eq("user_id", uid);
  });

  return NextResponse.json(
    {
      ok: true,
      requestId,
      status: "procesando",
      message: "Audio recibido. Se validará que haya voz y datos financieros; si no hay contenido válido, no se registrará nada.",
    },
    { status: 202 }
  );
}
