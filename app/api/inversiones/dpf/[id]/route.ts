import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actualizarDpf, borrarDpf, validarDpf, type DpfInput } from "@/lib/mutations/dpf";

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

  let input: DpfInput;
  try {
    input = (await request.json()) as DpfInput;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const errorMsg = validarDpf(input);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  try {
    await actualizarDpf(supabase, id, input);
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
    await borrarDpf(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al borrar" },
      { status: 500 }
    );
  }
}
