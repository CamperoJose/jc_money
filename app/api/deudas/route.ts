import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDeudas } from "@/lib/queries/deudas";
import { crearDeuda, validarDeuda, type DebtInput } from "@/lib/mutations/deudas";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const deudas = await getDeudas(supabase);
    return NextResponse.json({ deudas });
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

  let input: DebtInput;
  try {
    input = (await request.json()) as DebtInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const errorMsg = validarDeuda(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    const id = await crearDeuda(supabase, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear" }, { status: 500 });
  }
}
