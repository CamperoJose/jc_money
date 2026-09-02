import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET, fechaBoliviaHoy, isoAFechaBolivia } from "@/lib/datetime";
import { calcularTotalBob, redondear } from "@/lib/patrimonio";

export interface ResultadoJob {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  snapshot_id?: string;
  target_date?: string;
  base_date?: string;
  base_total_bob?: number;
  neto_dia_bob?: number;
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
 * Crea la foto de patrimonio AUTOCALCULADA que cierra el día `targetDate`
 * (por defecto, ayer en Bolivia), fechada a las 23:59 de ese día.
 *
 * Base = última foto (manual o auto) con snapshot_at <= 23:59 del targetDate.
 * Total = total de la base + (ingresos − gastos) registrados ese mismo día.
 * Los saldos de la base se copian para conservar la composición por cuenta.
 *
 * Idempotente por día: si ya existe una foto AUTO para `targetDate`, no repite.
 */
export async function ejecutarPatrimonioDiario(
  admin: SupabaseClient,
  opts?: { targetDate?: string }
): Promise<ResultadoJob> {
  const targetDate = opts?.targetDate ?? ayerBolivia();
  const targetAtISO = new Date(`${targetDate}T23:59:00${BOLIVIA_OFFSET}`).toISOString();

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  // Idempotencia: ¿ya hay una foto auto para ese día?
  const { data: yaExiste, error: eDup } = await admin
    .from("net_worth_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "auto")
    .eq("snapshot_date", targetDate)
    .limit(1);
  if (eDup) throw eDup;
  if (yaExiste && yaExiste.length > 0) {
    return { ok: true, skipped: true, reason: `Ya existe una foto auto para ${targetDate}.`, target_date: targetDate };
  }

  // Base: última foto en o antes de las 23:59 del targetDate.
  const { data: bases, error: eBase } = await admin
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, exchange_rate, kind, total_bob, net_worth_balances(account_id, amount, accounts(currency, is_liability))"
    )
    .eq("user_id", userId)
    .lte("snapshot_at", targetAtISO)
    .order("snapshot_at", { ascending: false })
    .limit(1);
  if (eBase) throw eBase;
  const base = bases?.[0] as Record<string, unknown> | undefined;
  if (!base) {
    return { ok: true, skipped: true, reason: "No hay foto base previa para calcular.", target_date: targetDate };
  }

  const rate = Number(base.exchange_rate);
  const balancesBase = ((base.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    account_id: b.account_id as string,
    amount: Number(b.amount),
    account: b.accounts as { currency: "BOB" | "USD" | "USDT"; is_liability: boolean },
  }));

  // Total base: para auto se confía en el almacenado; para manual se recalcula.
  const baseTotalBob =
    base.kind === "auto" && base.total_bob != null
      ? Number(base.total_bob)
      : calcularTotalBob(balancesBase, rate);

  // Neto del día: ingresos suman, gastos restan (en BOB, con el T/C de cada txn).
  const { data: txns, error: eTx } = await admin
    .from("transactions")
    .select("type, amount, currency, exchange_rate")
    .eq("user_id", userId)
    .eq("txn_date", targetDate);
  if (eTx) throw eTx;

  let netoDia = 0;
  for (const t of txns ?? []) {
    const amount = Number(t.amount);
    const enBob = t.currency === "BOB" ? amount : amount * (Number(t.exchange_rate) || 0);
    netoDia += t.type === "ingreso" ? enBob : -enBob;
  }
  netoDia = redondear(netoDia);

  const totalBob = redondear(baseTotalBob + netoDia);
  const totalUsd = rate ? redondear(totalBob / rate) : null;

  // Inserta la foto auto.
  const { data: snap, error: eIns } = await admin
    .from("net_worth_snapshots")
    .insert({
      user_id: userId,
      snapshot_date: targetDate,
      snapshot_at: targetAtISO,
      kind: "auto",
      exchange_rate: rate,
      total_bob: totalBob,
      total_usd: totalUsd,
      note: `Autocalculado: base del ${base.snapshot_date} (${baseTotalBob}) ${netoDia >= 0 ? "+" : "−"} ${Math.abs(netoDia)} de neto del día.`,
    })
    .select("id")
    .single();
  if (eIns) throw eIns;
  const snapId = snap.id as string;

  // Copia los saldos de la base para conservar la composición por cuenta.
  // OJO: con la service role el default `auth.uid()` no aplica, así que el
  // user_id debe ir explícito en cada fila (si no, viola el not-null de RLS).
  const filas = balancesBase.map((b) => ({
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
    base_date: base.snapshot_date as string,
    base_total_bob: baseTotalBob,
    neto_dia_bob: netoDia,
    total_bob: totalBob,
  };
}
