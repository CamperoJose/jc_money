import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET, fechaBoliviaHoy, isoAFechaBolivia } from "@/lib/datetime";
import { getTcConfig, getTcExacto } from "@/lib/queries/tc";
import { calcularEstadoPatrimonioConTc } from "@/lib/patrimonio/estado-con-tc";

export interface ResultadoJob { ok: boolean; skipped?: boolean; reason?: string; snapshot_id?: string; target_date?: string; base_date?: string; base_total_bob?: number; neto_dia_bob?: number; neto_sin_cuenta_bob?: number; ajuste_derivadas_bob?: number; derivadas?: Record<string, number>; ajuste_movimientos_bob?: number; movimientos?: string[]; total_bob?: number; }
function ayerBolivia(): string { const d = new Date(`${fechaBoliviaHoy()}T12:00:00${BOLIVIA_OFFSET}`); d.setUTCDate(d.getUTCDate() - 1); return isoAFechaBolivia(d.toISOString()); }

export async function ejecutarPatrimonioDiario(admin: SupabaseClient, opts?: { targetDate?: string; userId?: string }): Promise<ResultadoJob> {
  const targetDate = opts?.targetDate ?? ayerBolivia();
  const targetAtISO = new Date(`${targetDate}T23:59:00${BOLIVIA_OFFSET}`).toISOString();
  const userId = opts?.userId ?? process.env.JOB_USER_ID;
  if (!userId) return { ok: false, reason: "No hay usuario objetivo." };

  // El cierre diario NO puede heredar el T/C de la foto base. Debe existir una
  // cotización BCB exactamente para el día que se está cerrando.
  const cfg = await getTcConfig(admin, userId);
  const tc = await getTcExacto(admin, targetDate, cfg.cod_moneda, userId);
  if (!tc?.valor || tc.valor <= 0) {
    return { ok: false, reason: `No existe T/C BCB exacto para ${targetDate}.`, target_date: targetDate };
  }
  const rate = tc.valor;

  // Si ya existe una foto auto con el mismo T/C, el cierre es idempotente.
  // Si existe con otro T/C, es una foto incorrecta de una ejecución anterior:
  // se reconstruye usando el T/C real del día.
  const { data: yaAuto, error: eDup } = await admin
    .from("net_worth_snapshots")
    .select("id, exchange_rate")
    .eq("user_id", userId)
    .eq("kind", "auto")
    .eq("snapshot_date", targetDate)
    .limit(1);
  if (eDup) throw eDup;

  const snapshotExistente = yaAuto?.[0] as { id: string; exchange_rate: number } | undefined;
  if (snapshotExistente && Number(snapshotExistente.exchange_rate) === Number(rate)) {
    return { ok: true, skipped: true, reason: `Ya existe una foto auto correcta para ${targetDate}.`, target_date: targetDate };
  }

  // Excluimos la foto defectuosa al calcular la nueva, para que no se convierta
  // accidentalmente en la base del propio día que estamos reparando.
  const estado = await calcularEstadoPatrimonioConTc(
    admin,
    userId,
    targetDate,
    rate,
    snapshotExistente?.id
  );
  if (!estado) return { ok: true, skipped: true, reason: "No hay foto base previa para calcular.", target_date: targetDate };

  if (snapshotExistente) {
    const { error: eBalDelete } = await admin
      .from("net_worth_balances")
      .delete()
      .eq("snapshot_id", snapshotExistente.id)
      .eq("user_id", userId);
    if (eBalDelete) throw eBalDelete;

    const { error: eSnapDelete } = await admin
      .from("net_worth_snapshots")
      .delete()
      .eq("id", snapshotExistente.id)
      .eq("user_id", userId);
    if (eSnapDelete) throw eSnapDelete;
  }

  const { data: snap, error: eIns } = await admin
    .from("net_worth_snapshots")
    .insert({
      user_id: userId,
      snapshot_date: targetDate,
      snapshot_at: targetAtISO,
      kind: "auto",
      exchange_rate: rate,
      total_bob: estado.totalBob,
      total_usd: estado.totalUsd,
      note: estado.nota,
    })
    .select("id")
    .single();
  if (eIns) throw eIns;

  const snapId = snap.id as string;
  const filas = estado.balances.map((b) => ({
    user_id: userId,
    snapshot_id: snapId,
    account_id: b.account_id,
    amount: b.amount,
  }));
  if (filas.length) {
    const { error: eBal } = await admin.from("net_worth_balances").insert(filas);
    if (eBal) {
      await admin.from("net_worth_snapshots").delete().eq("id", snapId).eq("user_id", userId);
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
    derivadas: estado.derivadas.length ? Object.fromEntries(estado.derivadas.map((d) => [d.label, d.value])) : undefined,
    ajuste_movimientos_bob: estado.movimientos.length ? estado.ajusteMovimientos : undefined,
    movimientos: estado.movimientos.length ? estado.movimientos.map((m) => `${m.label}=${m.proceedsBob}`) : undefined,
    total_bob: estado.totalBob,
  };
}
