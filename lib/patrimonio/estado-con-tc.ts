import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET } from "@/lib/datetime";
import { calcularTotalBob, redondear } from "@/lib/patrimonio";
import {
  getCuentasDerivadas,
  getMovimientosPuntuales,
  rangoTransacciones,
  type BaseFoto,
  type CuentaMeta,
  type EstadoPatrimonio,
} from "@/lib/patrimonio/estado";

/**
 * Calcula el patrimonio de un día usando EXPLÍCITAMENTE el T/C de ese día.
 *
 * El cálculo normal parte del T/C almacenado en la foto base, lo cual es correcto
 * para una lectura histórica derivada, pero no para cerrar un día nuevo: el cierre
 * debe valuar todo con la cotización real del día que está cerrando.
 *
 * Se mantiene separado para no cambiar el comportamiento del dashboard en vivo.
 */
export async function calcularEstadoPatrimonioConTc(
  db: SupabaseClient,
  userId: string,
  hasta: string,
  rate: number,
  excludeSnapshotId?: string
): Promise<EstadoPatrimonio | null> {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`T/C inválido para ${hasta}: ${rate}`);
  }

  const hastaISO = new Date(`${hasta}T23:59:59${BOLIVIA_OFFSET}`).toISOString();
  let baseQuery = db
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, snapshot_at, kind, exchange_rate, total_bob, net_worth_balances(account_id, amount, accounts(currency, is_liability))"
    )
    .eq("user_id", userId)
    .lte("snapshot_at", hastaISO);

  if (excludeSnapshotId) baseQuery = baseQuery.neq("id", excludeSnapshotId);

  const [resBase, resCuentas] = await Promise.all([
    baseQuery.order("snapshot_at", { ascending: false }).limit(1),
    db.from("accounts").select("id, name, type, currency, is_liability").eq("user_id", userId),
  ]);

  if (resBase.error) throw resBase.error;
  if (resCuentas.error) throw resCuentas.error;

  const fila = resBase.data?.[0] as Record<string, unknown> | undefined;
  if (!fila) return null;

  const base: BaseFoto = {
    id: fila.id as string,
    snapshot_date: fila.snapshot_date as string,
    snapshot_at: fila.snapshot_at as string,
    kind: (fila.kind as "manual" | "auto") ?? "manual",
    exchange_rate: Number(fila.exchange_rate),
  };

  const balancesBase = ((fila.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    account_id: b.account_id as string,
    amount: Number(b.amount),
    account: b.accounts as { currency: "BOB" | "USD" | "USDT"; is_liability: boolean },
  }));

  if (balancesBase.length === 0) {
    throw new Error(
      `La foto del ${base.snapshot_date} no tiene saldos: no sirve como base. ` +
        "Bórrala desde Registros y vuelve a intentarlo."
    );
  }

  const baseTotalBob = redondear(calcularTotalBob(balancesBase, rate));
  const cuentas = (resCuentas.data ?? []) as CuentaMeta[];
  if (cuentas.length === 0) throw new Error("No hay cuentas: no se puede valuar el patrimonio por moneda.");

  const metaCuenta = new Map(
    cuentas.map((r) => [
      r.id,
      { name: r.name, type: r.type, currency: r.currency, is_liability: !!r.is_liability },
    ])
  );
  const monedaCuenta = new Map([...metaCuenta].map(([id, m]) => [id, m.currency] as const));
  const rango = rangoTransacciones(base, hasta);

  const [resTxns, derivadas, movimientos] = await Promise.all([
    db
      .from("transactions")
      .select("type, amount, currency, exchange_rate, account_id")
      .eq("user_id", userId)
      .gte("txn_date", rango.desde)
      .lte("txn_date", rango.hasta),
    getCuentasDerivadas(db, userId, rate, hasta, cuentas),
    getMovimientosPuntuales(db, userId, base.snapshot_date, hasta, rate, monedaCuenta),
  ]);

  if (resTxns.error) throw resTxns.error;

  const deltaPorCuenta = new Map<string, number>();
  let netoSinCuentaBob = 0;
  let netoBob = 0;

  for (const t of resTxns.data ?? []) {
    const amount = Number(t.amount);
    if (!Number.isFinite(amount)) continue;

    const enBob = t.currency === "BOB" ? amount : amount * (Number(t.exchange_rate) || 0);
    const signo = t.type === "ingreso" ? 1 : -1;
    netoBob += signo * enBob;

    const accId = (t as { account_id: string | null }).account_id;
    const meta = accId ? metaCuenta.get(accId) : undefined;
    if (!accId || !meta) {
      netoSinCuentaBob += signo * enBob;
      continue;
    }

    const enMonedaCuenta =
      t.currency === meta.currency
        ? amount
        : meta.currency === "BOB"
          ? enBob
          : rate
            ? enBob / rate
            : 0;

    const signoCuenta = meta.is_liability ? -signo : signo;
    deltaPorCuenta.set(
      accId,
      redondear((deltaPorCuenta.get(accId) ?? 0) + signoCuenta * enMonedaCuenta)
    );
  }

  netoBob = redondear(netoBob);
  netoSinCuentaBob = redondear(netoSinCuentaBob);

  let ajusteDerivadas = 0;
  for (const d of derivadas) {
    const enBase = balancesBase.find((b) => b.account_id === d.accountId)?.amount ?? 0;
    ajusteDerivadas += d.value - enBase;
  }
  ajusteDerivadas = redondear(ajusteDerivadas);

  const incrementos = new Map<string, number>();
  let ajusteMovimientos = 0;
  for (const m of movimientos) {
    ajusteMovimientos += m.proceedsBob;
    incrementos.set(
      m.destAccountId,
      redondear((incrementos.get(m.destAccountId) ?? 0) + m.destIncrement)
    );
  }
  ajusteMovimientos = redondear(ajusteMovimientos);

  const saldos = new Map<string, number>();
  for (const b of balancesBase) saldos.set(b.account_id, b.amount);
  for (const d of derivadas) saldos.set(d.accountId, d.value);
  for (const [accId, inc] of incrementos) {
    saldos.set(accId, redondear((saldos.get(accId) ?? 0) + inc));
  }
  for (const [accId, delta] of deltaPorCuenta) {
    saldos.set(accId, redondear((saldos.get(accId) ?? 0) + delta));
  }

  const balances = [...saldos].map(([account_id, amount]) => ({
    account_id,
    amount,
    account: {
      name: metaCuenta.get(account_id)?.name ?? "—",
      type: metaCuenta.get(account_id)?.type ?? "otro",
      currency: metaCuenta.get(account_id)?.currency ?? ("BOB" as const),
      is_liability: metaCuenta.get(account_id)?.is_liability ?? false,
    },
  }));

  const totalBob = redondear(calcularTotalBob(balances, rate) + netoSinCuentaBob);
  const totalUsd = redondear(totalBob / rate);
  const detalleDerivadas = derivadas.map((d) => `${d.label}=${d.value}`).join(", ");
  const detalleMovimientos = movimientos.map((m) => `${m.label}=${m.proceedsBob}`).join(", ");
  const nota =
    `Autocalculado: base del ${base.snapshot_date} (${baseTotalBob}) ` +
    `${netoBob >= 0 ? "+" : "−"} ${Math.abs(netoBob)} de neto` +
    (derivadas.length
      ? ` ${ajusteDerivadas >= 0 ? "+" : "−"} ${Math.abs(ajusteDerivadas)} de ajuste derivadas (${detalleDerivadas})`
      : "") +
    (movimientos.length
      ? ` ${ajusteMovimientos >= 0 ? "+" : "−"} ${Math.abs(ajusteMovimientos)} de movimientos (${detalleMovimientos})`
      : "") +
    (netoSinCuentaBob !== 0 ? ` (incluye ${netoSinCuentaBob} sin cuenta asignada)` : "") +
    `. T/C ${rate} correspondiente al ${hasta}.`;

  return {
    base,
    rate,
    baseTotalBob,
    balances,
    totalBob,
    totalUsd,
    netoBob,
    netoSinCuentaBob,
    ajusteDerivadas,
    derivadas,
    ajusteMovimientos,
    movimientos,
    cantidadMovimientosDia: (resTxns.data ?? []).length,
    nota,
  };
}
