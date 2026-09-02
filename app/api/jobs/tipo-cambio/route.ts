import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarTipoCambioBCB } from "@/lib/jobs/tipo-cambio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Verifica el token del scheduler (header Bearer o ?token=). */
function autorizado(request: Request): boolean {
  const esperado = process.env.API_BEARER_TOKEN;
  if (!esperado) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${esperado}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("token") === esperado;
}

function detalleError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const partes = [o.message, o.details, o.hint, o.code].filter(Boolean);
    if (partes.length) return partes.join(" | ");
    try {
      return JSON.stringify(o);
    } catch {
      return "Error desconocido";
    }
  }
  return String(e);
}

async function manejar(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // date opcional (YYYY-MM-DD) para backfill de un día puntual.
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") ?? undefined;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "Parámetro date inválido (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const resultado = await ejecutarTipoCambioBCB(admin, { targetDate });
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: detalleError(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return manejar(request);
}

export async function GET(request: Request) {
  return manejar(request);
}
