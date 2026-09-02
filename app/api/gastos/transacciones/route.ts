import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTransacciones } from "@/lib/queries/gastos";
import {
  crearTransaccion,
  validarTransaccion,
  type TransaccionInput,
} from "@/lib/mutations/gastos";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const transacciones = await getTransacciones(supabase);
    return NextResponse.json({ transacciones });
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

  let input: TransaccionInput;
  try {
    input = (await request.json()) as TransaccionInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const errorMsg = validarTransaccion(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    const id = await crearTransaccion(supabase, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}
