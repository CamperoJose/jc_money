import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantes } from "@/lib/queries/gastos";
import { crearParticipante } from "@/lib/mutations/parametros";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const participantes = await getParticipantes(supabase);
    return NextResponse.json({ participantes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

  try {
    const id = await crearParticipante(supabase, body.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}
