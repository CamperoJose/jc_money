import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActivos } from "@/lib/queries/activos";
import { crearActivo, validarActivo, type AssetInput } from "@/lib/mutations/activos";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const activos = await getActivos(supabase);
    return NextResponse.json({ activos });
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

  let input: AssetInput;
  try {
    input = (await request.json()) as AssetInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const errorMsg = validarActivo(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    const id = await crearActivo(supabase, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear" }, { status: 500 });
  }
}
