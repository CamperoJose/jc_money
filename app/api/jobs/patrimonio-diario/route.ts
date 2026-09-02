import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarPatrimonioDiario } from "@/lib/jobs/patrimonio-diario";

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

async function manejar(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // targetDate opcional (YYYY-MM-DD) para recalcular un día puntual / backfill.
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") ?? undefined;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "Parámetro date inválido (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const resultado = await ejecutarPatrimonioDiario(admin, { targetDate });
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error en el job" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return manejar(request);
}

// GET permitido para poder dispararlo fácil desde cron-job.org / navegador con token.
export async function GET(request: Request) {
  return manejar(request);
}
