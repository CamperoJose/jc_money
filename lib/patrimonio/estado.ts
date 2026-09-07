import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET } from "@/lib/datetime";
import { calcularTotalBob, redondear } from "@/lib/patrimonio";

/**
 * Cálculo del estado del patrimonio a una fecha dada, a partir de la última foto
 * más todo lo ocurrido después.
 *
 * Es una FUNCIÓN PURA sobre los datos actuales (no escribe nada), y la usan dos
 * consumidores:
 *   - El dashboard, para mostrar el patrimonio AL INSTANTE, sin esperar al
 *     cierre de medianoche. Al derivarse de los datos vigentes, editar o borrar
 *     un gasto se refleja solo: no hay cadena de fotos que recalcular.
 *   - El job diario, que llama a esto mismo y PERSISTE el resultado como la foto
 *     automática del día.
 *
 * Que ambos usen el mismo código es el punto: la lógica duplicada entre lectura
 * y cierre es justo donde aparecieron los errores de cálculo anteriores.
 */

export interface CuentaDerivada {
  accountId: string;
  label: string;
  value: number;
}

export interface MovimientoPuntual {
  label: string;
  destAccountId: string;
  /** Aporte al total en BOB (negativo si sale dinero de la cuenta). */
  proceedsBob: number;
  /** Incremento en la cuenta destino, en su moneda nativa. */
  destIncrement: number;
}

export interface BaseFoto {
  id: string;
  snapshot_date: string;
  snapshot_at: string;
  kind: "manual" | "auto";
  exchange_rate: number;
}

export interface EstadoPatrimonio {
  base: BaseFoto;
  /** T/C heredado de la base (no se altera la valuación histórica en silencio). */
  rate: number;
  baseTotalBob: number;
  /** Saldos resultantes, cuenta por cuenta, listos para persistir o mostrar. */
  balances: Array<{
    account_id: string;
    amount: number;
    account: { currency: "BOB" | "USD" | "USDT"; is_liability: boolean };
  }>;
  totalBob: number;
  totalUsd: number | null;
  /** Efecto de gastos e ingresos posteriores a la base (BOB). */
  netoBob: number;
  /** Parte de ese neto que no se pudo atribuir a ninguna cuenta. */
  netoSinCuentaBob: number;
  ajusteDerivadas: number;
  derivadas: CuentaDerivada[];
  ajusteMovimientos: number;
  movimientos: MovimientoPuntual[];
  /** Cuántos gastos/ingresos se aplicaron sobre la base. */
  cantidadMovimientosDia: number;
  /** Texto explicativo, reutilizado por el job como nota de la foto. */
  nota: string;
}

/** Busca el id de una cuenta por tipo o por nombre. */
async function cuentaIdPor(
  db: SupabaseClient,
  userId: string,
  match: { type?: string; name?: string }
): Promise<string | null> {
  let q = db.from("accounts").select("id").eq("user_id", userId);
  if (match.type) q = q.eq("type", match.type);
  if (match.name) q = q.eq("name", match.name);
  const { data } = await q.order("created_at", { ascending: true }).limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Cuentas cuyo saldo se AUTOCALCULA (no se copia de la base):
 *  - DPF (Σ principal de DPF activos)
 *  - Por Cobrar (Σ saldo de deudas no pagadas)
 *  - Activos (Σ valor de activos que cuentan en patrimonio, en BOB)
 * Cada fuente es resiliente: si su tabla/columna aún no existe (migración sin
 * aplicar), se omite y se conserva el saldo de la base para esa cuenta.
 */
export async function getCuentasDerivadas(
  db: SupabaseClient,
  userId: string,
  rate: number
): Promise<CuentaDerivada[]> {
  const out: CuentaDerivada[] = [];

  try {
    const accountId = await cuentaIdPor(db, userId, { type: "dpf" });
    if (accountId) {
      const { data, error } = await db
        .from("dpf_deposits")
        .select("principal")
        .eq("user_id", userId)
        .eq("status", "activo");
      if (error) throw error;
      const value = redondear(
        (data ?? []).reduce((s, d) => s + Number((d as { principal: number }).principal), 0)
      );
      out.push({ accountId, label: "DPF", value });
    }
  } catch { /* tabla no lista: se omite */ }

  try {
    const accountId = await cuentaIdPor(db, userId, { type: "por_cobrar" });
    if (accountId) {
      const { data, error } = await db
        .from("debts")
        .select("amount, paid_amount, status")
        .eq("user_id", userId)
        .neq("status", "pagado");
      if (error) throw error;
      const value = redondear(
        (data ?? []).reduce((s, d) => {
          const r = d as { amount: number; paid_amount?: number };
          return s + Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0));
        }, 0)
      );
      out.push({ accountId, label: "Por Cobrar", value });
    }
  } catch { /* tabla/columna no lista: se omite */ }

  try {
    const accountId = await cuentaIdPor(db, userId, { name: "Activos" });
    if (accountId) {
      const { data, error } = await db
        .from("assets")
        .select("acquisition_cost, current_value, currency")
        .eq("user_id", userId)
        .eq("status", "activo")
        .eq("counts_in_patrimonio", true);
      if (error) throw error;
      const value = redondear(
        (data ?? []).reduce((s, a) => {
          const r = a as {
            acquisition_cost: number;
            current_value: number | null;
            currency: string;
          };
          const val = r.current_value != null ? Number(r.current_value) : Number(r.acquisition_cost);
          return s + (r.currency === "BOB" ? val : val * rate);
        }, 0)
      );
      out.push({ accountId, label: "Activos", value });
    }
  } catch { /* tabla no lista: se omite */ }

  return out;
}

/**
 * Movimientos puntuales que mueven dinero entre una cuenta real y una derivada,
 * ocurridos DESPUÉS de la fecha de la base y hasta `hasta`:
 *   - Venta de activos  → ENTRA el precio de venta a `sold_account_id`.
 *   - Cobro de deudas   → ENTRA el monto cobrado a `paid_account_id`.
 *   - Préstamo otorgado → SALE el monto prestado de `source_account_id`.
 * La contraparte de los tres es una cuenta derivada, que se recalcula aparte;
 * por eso el efecto neto en el total es el resultado realizado (venta) o CERO
 * (cobrar y prestar solo cambian dónde está el dinero).
 *
 * El corte inferior es SIEMPRE exclusivo, también con una base manual: una foto
 * manual son saldos reales observados, así que un préstamo del mismo día ya está
 * reflejado en ellos y volver a restarlo lo contaría dos veces. (Los gastos son
 * el caso contrario y se tratan aparte; ver `rangoTransacciones`.)
 */
export async function getMovimientosPuntuales(
  db: SupabaseClient,
  userId: string,
  baseDate: string,
  hasta: string,
  rate: number,
  monedaCuenta: Map<string, "BOB" | "USD" | "USDT">
): Promise<MovimientoPuntual[]> {
  const out: MovimientoPuntual[] = [];
  const aNativo = (bob: number, accId: string): number => {
    const cur = monedaCuenta.get(accId) ?? "BOB";
    return cur === "BOB" ? bob : rate ? bob / rate : 0;
  };

  // Ventas de activos.
  try {
    const { data, error } = await db
      .from("assets")
      .select("sold_price, currency, sold_date, sold_account_id")
      .eq("user_id", userId)
      .eq("status", "vendido")
      .gt("sold_date", baseDate)
      .lte("sold_date", hasta)
      .not("sold_account_id", "is", null);
    if (error) throw error;
    for (const r of data ?? []) {
      const a = r as { sold_price: number | null; currency: string; sold_account_id: string };
      const price = Number(a.sold_price);
      if (!a.sold_account_id || !Number.isFinite(price) || price <= 0) continue;
      const bob = redondear(a.currency === "BOB" ? price : price * rate);
      out.push({
        label: "Venta activo",
        destAccountId: a.sold_account_id,
        proceedsBob: bob,
        destIncrement: redondear(aNativo(bob, a.sold_account_id)),
      });
    }
  } catch { /* columna no lista: se omite */ }

  // Préstamos otorgados: el dinero SALE de la cuenta de origen.
  try {
    const { data, error } = await db
      .from("debts")
      .select("amount, debt_date, source_account_id")
      .eq("user_id", userId)
      .gt("debt_date", baseDate)
      .lte("debt_date", hasta)
      .not("source_account_id", "is", null);
    if (error) throw error;
    for (const r of data ?? []) {
      const d = r as { amount: number | null; source_account_id: string };
      const monto = Number(d.amount);
      if (!d.source_account_id || !Number.isFinite(monto) || monto <= 0) continue;
      const bob = redondear(monto);
      out.push({
        label: "Préstamo otorgado",
        destAccountId: d.source_account_id,
        proceedsBob: -bob,
        destIncrement: -redondear(aNativo(bob, d.source_account_id)),
      });
    }
  } catch { /* columna no lista: se omite */ }

  // Cobros de deudas.
  try {
    const { data, error } = await db
      .from("debts")
      .select("paid_amount, collected_date, paid_account_id")
      .eq("user_id", userId)
      .gt("collected_date", baseDate)
      .lte("collected_date", hasta)
      .not("paid_account_id", "is", null);
    if (error) throw error;
    for (const r of data ?? []) {
      const d = r as { paid_amount: number | null; paid_account_id: string };
      const paid = Number(d.paid_amount);
      if (!d.paid_account_id || !Number.isFinite(paid) || paid <= 0) continue;
      const bob = redondear(paid);
      out.push({
        label: "Cobro deuda",
        destAccountId: d.paid_account_id,
        proceedsBob: bob,
        destIncrement: redondear(aNativo(bob, d.paid_account_id)),
      });
    }
  } catch { /* columna no lista: se omite */ }

  return out;
}

/**
 * Rango de fechas de las transacciones que se aplican sobre una base.
 *
 * La regla depende del tipo de la foto base, y no es un capricho:
 *   - Una foto AUTO ya lleva aplicados los gastos de su propio día, así que se
 *     cuenta desde el día SIGUIENTE.
 *   - Una foto MANUAL son saldos "en bruto": el usuario confirmó que los gastos
 *     de ese mismo día deben contarse igual, sin importar la hora (decisión E4).
 *
 * Además el corte superior es `hasta` y no "el día de la base + 1": si el cierre
 * no corrió durante varios días, los días intermedios se aplican igual en vez de
 * perderse.
 */
export function rangoTransacciones(base: BaseFoto, hasta: string): { desde: string; hasta: string } {
  if (base.kind === "manual") return { desde: base.snapshot_date, hasta };
  const d = new Date(`${base.snapshot_date}T12:00:00${BOLIVIA_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { desde: d.toISOString().slice(0, 10), hasta };
}

/**
 * Calcula el estado del patrimonio a la fecha `hasta` (YYYY-MM-DD, zona
 * Bolivia). Devuelve `null` si todavía no existe ninguna foto base.
 */
export async function calcularEstadoPatrimonio(
  db: SupabaseClient,
  userId: string,
  hasta: string
): Promise<EstadoPatrimonio | null> {
  const hastaISO = new Date(`${hasta}T23:59:59${BOLIVIA_OFFSET}`).toISOString();

  // Base = el último registro (manual o auto) en o antes del corte.
  const { data: bases, error: eBase } = await db
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, snapshot_at, kind, exchange_rate, total_bob, net_worth_balances(account_id, amount, accounts(currency, is_liability))"
    )
    .eq("user_id", userId)
    .lte("snapshot_at", hastaISO)
    .order("snapshot_at", { ascending: false })
    .limit(1);
  if (eBase) throw eBase;
  const fila = bases?.[0] as Record<string, unknown> | undefined;
  if (!fila) return null;

  const base: BaseFoto = {
    id: fila.id as string,
    snapshot_date: fila.snapshot_date as string,
    snapshot_at: fila.snapshot_at as string,
    kind: (fila.kind as "manual" | "auto") ?? "manual",
    exchange_rate: Number(fila.exchange_rate),
  };
  const rate = base.exchange_rate;

  const balancesBase = ((fila.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    account_id: b.account_id as string,
    amount: Number(b.amount),
    account: b.accounts as { currency: "BOB" | "USD" | "USDT"; is_liability: boolean },
  }));

  // El total de la base se recalcula SIEMPRE desde sus saldos: la foto nueva se
  // arma a partir de ellos, así que tomar un total almacenado que no cuadre haría
  // que la explicación contradijera al detalle.
  const baseTotalBob = calcularTotalBob(balancesBase, rate);

  // Cuentas: moneda y si son pasivo.
  const { data: cuentasData } = await db
    .from("accounts")
    .select("id, currency, is_liability")
    .eq("user_id", userId);
  const metaCuenta = new Map(
    (cuentasData ?? []).map((c) => {
      const r = c as { id: string; currency: "BOB" | "USD" | "USDT"; is_liability: boolean };
      return [r.id, { currency: r.currency, is_liability: !!r.is_liability }];
    })
  );
  const monedaCuenta = new Map([...metaCuenta].map(([id, m]) => [id, m.currency] as const));

  // Gastos e ingresos posteriores a la base, repartidos CUENTA POR CUENTA.
  const rango = rangoTransacciones(base, hasta);
  const { data: txns, error: eTx } = await db
    .from("transactions")
    .select("type, amount, currency, exchange_rate, account_id")
    .eq("user_id", userId)
    .gte("txn_date", rango.desde)
    .lte("txn_date", rango.hasta);
  if (eTx) throw eTx;

  const deltaPorCuenta = new Map<string, number>();
  let netoSinCuentaBob = 0;
  let netoBob = 0;
  for (const t of txns ?? []) {
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
    // En un pasivo, un gasto AUMENTA el saldo (más deuda) y por eso resta al
    // total, que ya descuenta los pasivos.
    const signoCuenta = meta.is_liability ? -signo : signo;
    deltaPorCuenta.set(
      accId,
      redondear((deltaPorCuenta.get(accId) ?? 0) + signoCuenta * enMonedaCuenta)
    );
  }
  netoBob = redondear(netoBob);
  netoSinCuentaBob = redondear(netoSinCuentaBob);

  // Cuentas derivadas y movimientos puntuales.
  const derivadas = await getCuentasDerivadas(db, userId, rate);
  let ajusteDerivadas = 0;
  for (const d of derivadas) {
    const enBase = balancesBase.find((b) => b.account_id === d.accountId)?.amount ?? 0;
    ajusteDerivadas += d.value - enBase;
  }
  ajusteDerivadas = redondear(ajusteDerivadas);

  const movimientos = await getMovimientosPuntuales(
    db,
    userId,
    base.snapshot_date,
    hasta,
    rate,
    monedaCuenta
  );
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

  // Saldos resultantes = base + derivadas + movimientos + neto por cuenta.
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
      currency: metaCuenta.get(account_id)?.currency ?? ("BOB" as const),
      is_liability: metaCuenta.get(account_id)?.is_liability ?? false,
    },
  }));

  // El total sale DE LOS SALDOS, no de sumar piezas por separado: así siempre
  // vale total = Σ(saldos) y el diff por cuenta explica el cambio completo.
  const totalBob = redondear(calcularTotalBob(balances, rate) + netoSinCuentaBob);
  const totalUsd = rate ? redondear(totalBob / rate) : null;

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
    ".";

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
    cantidadMovimientosDia: (txns ?? []).length,
    nota,
  };
}
