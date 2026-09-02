import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDpfs } from "@/lib/queries/dpf";
import { crearDpf, validarDpf, type DpfInput } from "@/lib/mutations/dpf";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const dpfs = await getDpfs(supabase);
    return NextResponse.json({ dpfs });
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

  let input: DpfInput;
  try {
    input = (await request.json()) as DpfInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const errorMsg = validarDpf(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    const id = await crearDpf(supabase, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}
