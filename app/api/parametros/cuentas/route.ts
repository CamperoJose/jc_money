import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCuentas } from "@/lib/queries/patrimonio";
import { crearCuenta, actualizarCuenta, borrarCuenta } from "@/lib/mutations/cuentas";
import type { AccountType, Currency } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { return NextResponse.json({ cuentas: await getCuentas(supabase) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = await request.json() as { name?: string; type?: AccountType; currency?: Currency; is_liability?: boolean };
    if (!body.name || !body.type || !body.currency) return NextResponse.json({ error: "Nombre, tipo y moneda son obligatorios." }, { status: 400 });
    const id = await crearCuenta(supabase, { name: body.name, type: body.type, currency: body.currency, is_liability: Boolean(body.is_liability) });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = await request.json() as { id?: string; name?: string; type?: AccountType; currency?: Currency; is_liability?: boolean; active?: boolean };
    if (!body.id) return NextResponse.json({ error: "El id es obligatorio." }, { status: 400 });
    const { id, ...campos } = body;
    await actualizarCuenta(supabase, id, campos);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "El id es obligatorio." }, { status: 400 });
    await borrarCuenta(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se puede borrar la cuenta. Si tiene historial, desactívala." }, { status: 409 }); }
}
