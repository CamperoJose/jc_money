import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCuentas } from "@/lib/queries/patrimonio";
import { crearCuenta, actualizarCuenta, borrarCuenta } from "@/lib/mutations/cuentas";
import type { AccountType, Currency } from "@/lib/types";

async function auth() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user }; }

export async function GET() {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { return NextResponse.json({ cuentas: await getCuentas(supabase) }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = await request.json() as { name?: string; type?: AccountType; currency?: Currency; is_liability?: boolean };
    if (!body.name || !body.type || !body.currency) return NextResponse.json({ error: "Nombre, tipo y moneda son obligatorios." }, { status: 400 });
    if (body.type === "dpf" || body.type === "por_cobrar") {
      const { data } = await supabase.from("accounts").select("id").eq("type", body.type).limit(1);
      if (data?.length) return NextResponse.json({ error: `Ya existe una cuenta de tipo ${body.type}. Puedes editarla desde aquí.` }, { status: 409 });
    }
    const id = await crearCuenta(supabase, { name: body.name, type: body.type, currency: body.currency, is_liability: Boolean(body.is_liability) });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear" }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = await request.json() as { id?: string; name?: string; type?: AccountType; currency?: Currency; is_liability?: boolean; active?: boolean };
    if (!body.id) return NextResponse.json({ error: "El id es obligatorio." }, { status: 400 });
    const { data: actual } = await supabase.from("accounts").select("system_key, type").eq("id", body.id).maybeSingle();
    if (!actual) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    if (actual.system_key === "assets" && (body.name !== undefined || body.type !== undefined || body.currency !== undefined || body.is_liability !== undefined)) return NextResponse.json({ error: "La cuenta de Activos es necesaria para el cálculo del patrimonio; solo puede activarse o desactivarse." }, { status: 409 });
    if ((body.type === "dpf" || body.type === "por_cobrar") && body.type !== actual.type) {
      const { data } = await supabase.from("accounts").select("id").eq("type", body.type).neq("id", body.id).limit(1);
      if (data?.length) return NextResponse.json({ error: `Ya existe una cuenta de tipo ${body.type}.` }, { status: 409 });
    }
    const { id, ...campos } = body; await actualizarCuenta(supabase, id, campos); return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error al actualizar" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const { supabase, user } = await auth(); if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "El id es obligatorio." }, { status: 400 });
    const { data: actual } = await supabase.from("accounts").select("system_key, type").eq("id", id).maybeSingle();
    if (!actual) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    if (actual.system_key === "assets" || actual.type === "dpf" || actual.type === "por_cobrar") return NextResponse.json({ error: "Esta cuenta participa en cálculos del patrimonio. Desactívala en lugar de borrarla." }, { status: 409 });
    await borrarCuenta(supabase, id); return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se puede borrar la cuenta. Si tiene historial, desactívala." }, { status: 409 }); }
}
