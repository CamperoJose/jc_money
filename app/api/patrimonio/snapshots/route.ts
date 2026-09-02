import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSnapshots } from "@/lib/queries/patrimonio";
import { crearRegistro, validarRegistro, type RegistroInput } from "@/lib/mutations/patrimonio";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const snapshots = await getSnapshots(supabase);
    return NextResponse.json({ snapshots });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let input: RegistroInput;
  try {
    input = (await request.json()) as RegistroInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const errorMsg = validarRegistro(input);
  if (errorMsg) {
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const id = await crearRegistro(supabase, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}
