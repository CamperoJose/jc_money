import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTcConfig } from "@/lib/queries/tc";
import { setTcConfig } from "@/lib/mutations/tc";
import type { TcConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const config = await getTcConfig(supabase);
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Partial<TcConfig>;
  try {
    body = (await request.json()) as Partial<TcConfig>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cod_indicador = Number(body.cod_indicador);
  const cod_moneda = Number(body.cod_moneda);
  if (!Number.isInteger(cod_indicador) || cod_indicador < 1) {
    return NextResponse.json({ error: "Código de indicador inválido." }, { status: 400 });
  }
  if (!Number.isInteger(cod_moneda) || cod_moneda < 1) {
    return NextResponse.json({ error: "Código de moneda inválido." }, { status: 400 });
  }

  try {
    await setTcConfig(supabase, { cod_indicador, cod_moneda });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
