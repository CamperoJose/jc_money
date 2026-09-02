import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/queries/gastos";
import { crearCategoria } from "@/lib/mutations/parametros";
import type { CategoryKind } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const categorias = await getCategorias(supabase);
    return NextResponse.json({ categorias });
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

  let body: { name?: string; kind?: CategoryKind };
  try {
    body = (await request.json()) as { name?: string; kind?: CategoryKind };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  if (!body.kind) return NextResponse.json({ error: "El tipo de categoría es obligatorio." }, { status: 400 });

  try {
    const id = await crearCategoria(supabase, body.name, body.kind);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear" },
      { status: 500 }
    );
  }
}
