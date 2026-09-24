import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarTipoCambioBinanceP2P } from "@/lib/jobs/tipo-cambio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    // El T/C es transversal a todos los usuarios. Cualquier usuario autenticado
    // puede refrescar la cotización global y el upsert reemplaza el valor del día.
    const admin = createAdminClient();
    const resultado = await ejecutarTipoCambioBinanceP2P(admin);

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, error: resultado.reason ?? "No se pudo actualizar el tipo de cambio." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Error al actualizar el tipo de cambio.",
      },
      { status: 500 }
    );
  }
}
