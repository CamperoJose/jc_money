import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crearTransaccion, validarTransaccion, type TransaccionInput } from "@/lib/mutations/gastos";
import { crearDeuda, validarDeuda, type DebtInput } from "@/lib/mutations/deudas";
import { fechaBoliviaHoy } from "@/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GastoConfirmado {
  descripcion?: string | null;
  monto: number;
  moneda: "BOB" | "USD" | "USDT";
  exchange_rate?: number | null;
  cuenta_id?: string | null;
  categoria_id?: string | null;
}
interface DeudaConfirmada {
  quien?: string | null;
  monto: number;
  motivo?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let payload: { gastos?: GastoConfirmado[]; deudas?: DeudaConfirmada[] };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const gastos = Array.isArray(payload.gastos) ? payload.gastos : [];
  const deudas = Array.isArray(payload.deudas) ? payload.deudas : [];
  if (gastos.length === 0 && deudas.length === 0) {
    return NextResponse.json({ error: "No hay nada que registrar." }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const hoy = fechaBoliviaHoy();

  // Valida todo ANTES de insertar (para no dejar registros a medias).
  const inputsGasto: TransaccionInput[] = gastos.map((g) => ({
    occurred_at: ahora,
    type: "gasto",
    amount: Number(g.monto),
    currency: g.moneda,
    exchange_rate: g.moneda === "BOB" ? null : g.exchange_rate ?? null,
    account_id: g.cuenta_id ?? null,
    category_id: g.categoria_id ?? null,
    description: g.descripcion ?? null,
    source: "voz",
  }));
  const inputsDeuda: DebtInput[] = deudas.map((d) => ({
    debt_date: hoy,
    amount: Number(d.monto),
    paid_amount: 0,
    reason: d.motivo ?? null,
    counterparty: d.quien ?? null,
    status: "pendiente",
  }));

  for (const g of inputsGasto) {
    const err = validarTransaccion(g);
    if (err) return NextResponse.json({ error: `Gasto inválido: ${err}` }, { status: 400 });
  }
  for (const d of inputsDeuda) {
    const err = validarDeuda(d);
    if (err) return NextResponse.json({ error: `Deuda inválida: ${err}` }, { status: 400 });
  }

  try {
    let nGastos = 0;
    let nDeudas = 0;
    for (const g of inputsGasto) {
      await crearTransaccion(supabase, g);
      nGastos++;
    }
    for (const d of inputsDeuda) {
      await crearDeuda(supabase, d);
      nDeudas++;
    }
    return NextResponse.json({ ok: true, gastos: nGastos, deudas: nDeudas }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al registrar." },
      { status: 500 }
    );
  }
}
