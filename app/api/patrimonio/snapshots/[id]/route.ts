import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarRegistro,
  borrarRegistro,
  validarRegistro,
  type RegistroInput,
} from "@/lib/mutations/patrimonio";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;

  let input: RegistroInput;
  try {
    input = (await request.json()) as RegistroInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const errorMsg = validarRegistro(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    await actualizarRegistro(supabase, id, input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    await borrarRegistro(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al borrar" },
      { status: 500 }
    );
  }
}
