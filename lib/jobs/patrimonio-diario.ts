import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET, fechaBoliviaHoy, isoAFechaBolivia } from "@/lib/datetime";
import { calcularEstadoPatrimonio } from "@/lib/patrimonio/estado";

export interface ResultadoJob {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  snapshot_id?: string;
  target_date?: string;
  base_date?: string;
  base_total_bob?: number;
  neto_dia_bob?: number;
  /** Parte del neto que no se pudo atribuir a ninguna cuenta. */
  neto_sin_cuenta_bob?: number;
  ajuste_derivadas_bob?: number;
  derivadas?: Record<string, number>;
  ajuste_movimientos_bob?: number;
  movimientos?: string[];
  total_bob?: number;
}

/** "Ayer" en zona Bolivia como YYYY-MM-DD (fecha que cierra el job). */
function ayerBolivia(): string {
  const d = new Date(`${fechaBoliviaHoy()}T12:00:00${BOLIVIA_OFFSET}`);
  d.setUTCDate(d.getUTCDate() - 1);
  return isoAFechaBolivia(d.toISOString());
}

/**
 * Determina el único usuario de la app (app monousuario) leyendo de tablas con
 * la service role (evita el endpoint admin de auth, que exige la key exacta).
 * Con la service role, RLS se omite y estas lecturas devuelven la fila.
 */
async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  for (const tabla of ["net_worth_snapshots", "accounts", "transactions"]) {
    const { data, error } = await admin.from(tabla).select("user_id").limit(1);
    if (error) throw error;
    if (data && data.length > 0) return (data[0] as { user_id: string }).user_id;
  }
  return null;
}

/**
 * Cierra el día `targetDate` (por defecto, ayer en Bolivia) guardando una foto
 * AUTOCALCULADA fechada a las 23:59 de ese día.
 *
 * TODO el cálculo vive en `lib/patrimonio/estado.ts` y es el mismo que usa el
 * dashboard para mostrar el patrimonio al instante. Aquí solo queda lo propio
 * del cierre: idempotencia, persistencia y el informe del resultado. Antes esta
 * lógica estaba duplicada entre lectura y cierre, que es donde aparecieron los
 * errores de cálculo.
 *
 * NUNCA modifica ni borra fotos existentes; solo inserta su propia foto auto.
 * Manuales y automática COEXISTEN en un mismo día; lo único que no puede haber
 * es DOS automáticas (idempotencia: se omite si ya existe una auto ese día).
 */
export async function ejecutarPatrimonioDiario(
  admin: SupabaseClient,
  opts?: { targetDate?: string }
): Promise<ResultadoJob> {
  const targetDate = opts?.targetDate ?? ayerBolivia();
  const targetAtISO = new Date(`${targetDate}T23:59:00${BOLIVIA_OFFSET}`).toISOString();

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  // Idempotencia: NUNCA dos automáticas el mismo día. Las fotos MANUALES sí
  // pueden coexistir con la automática.
  const { data: yaAuto, error: eDup } = await admin
    .from("net_worth_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "auto")
    .eq("snapshot_date", targetDate)
    .limit(1);
  if (eDup) throw eDup;
  if (yaAuto && yaAuto.length > 0) {
    return {
      ok: true,
      skipped: true,
      reason: `Ya existe una foto auto para ${targetDate}.`,
      target_date: targetDate,
    };
  }

  const estado = await calcularEstadoPatrimonio(admin, userId, targetDate);
  if (!estado) {
    return {
      ok: true,
      skipped: true,
      reason: "No hay foto base previa para calcular.",
      target_date: targetDate,
    };
  }

  const { data: snap, error: eIns } = await admin
    .from("net_worth_snapshots")
    .insert({
      user_id: userId,
      snapshot_date: targetDate,
      snapshot_at: targetAtISO,
      kind: "auto",
      exchange_rate: estado.rate,
      total_bob: estado.totalBob,
      total_usd: estado.totalUsd,
      note: estado.nota,
    })
    .select("id")
    .single();
  if (eIns) throw eIns;
  const snapId = snap.id as string;

  // Guarda los saldos ya calculados. OJO: con la service role el default
  // `auth.uid()` no aplica, así que el user_id debe ir explícito (RLS not-null).
  const filas = estado.balances.map((b) => ({
    user_id: userId,
    snapshot_id: snapId,
    account_id: b.account_id,
    amount: b.amount,
  }));
  if (filas.length) {
    const { error: eBal } = await admin.from("net_worth_balances").insert(filas);
    if (eBal) {
      // Rollback manual: sin transacción entre requests, evita dejar una foto
      // auto sin balances (que la idempotencia luego saltaría, quedando corrupta).
      await admin.from("net_worth_snapshots").delete().eq("id", snapId);
      throw eBal;
    }
  }

  return {
    ok: true,
    snapshot_id: snapId,
    target_date: targetDate,
    base_date: estado.base.snapshot_date,
    base_total_bob: estado.baseTotalBob,
    neto_dia_bob: estado.netoBob,
    neto_sin_cuenta_bob: estado.netoSinCuentaBob || undefined,
    ajuste_derivadas_bob: estado.derivadas.length ? estado.ajusteDerivadas : undefined,
    derivadas: estado.derivadas.length
      ? Object.fromEntries(estado.derivadas.map((d) => [d.label, d.value]))
      : undefined,
    ajuste_movimientos_bob: estado.movimientos.length ? estado.ajusteMovimientos : undefined,
    movimientos: estado.movimientos.length
      ? estado.movimientos.map((m) => `${m.label}=${m.proceedsBob}`)
      : undefined,
    total_bob: estado.totalBob,
  };
}
