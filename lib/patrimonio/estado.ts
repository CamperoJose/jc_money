import type { SupabaseClient } from "@supabase/supabase-js";
import { BOLIVIA_OFFSET } from "@/lib/datetime";
import { calcularTotalBob, redondear, TIPOS_LIQUIDOS } from "@/lib/patrimonio";

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
    account: {
      name: string;
      type: string;
      currency: "BOB" | "USD" | "USDT";
      is_liability: boolean;
    };
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

/**
 * ¿El error es "esa tabla o columna todavía no existe"?
 *
 * El módulo tolera a propósito que una migración no esté aplicada: la app no
 * debe romperse por eso. Pero esa tolerancia NO puede extenderse a cualquier
 * error: un timeout de red haría que la cuenta derivada se quedara con el valor
 * de la base, y el job persistiría ese número equivocado como la verdad del día,
 * en silencio. Cualquier otro error se propaga.
 */
function esMigracionPendiente(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; message?: string };
  const code = e.code ?? "";
  // Postgres: 42P01 tabla inexistente, 42703 columna inexistente.
  // PostgREST: PGRST20x cuando no encuentra la tabla/columna en su caché.
  if (code === "42P01" || code === "42703" || code.startsWith("PGRST2")) return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find");
}

/**
 * Extrae las filas de una lectura hecha con `allSettled`, distinguiendo la
 * migración pendiente (devuelve `null`: la cuenta conserva el saldo de la base)
 * de un fallo real (lanza).
 */
function filasDe<T>(
  resultado: PromiseSettledResult<{ data: unknown; error: unknown }>,
  contexto: string
): T[] | null {
  if (resultado.status === "rejected") {
    if (esMigracionPendiente(resultado.reason)) return null;
    throw resultado.reason;
  }
  const { data, error } = resultado.value;
  if (error) {
    if (esMigracionPendiente(error)) return null;
    throw new Error(`Error al leer ${contexto}: ${(error as { message?: string }).message ?? error}`);
  }
  return (data ?? []) as T[];
}

/** Cuenta del usuario, tal como la necesita este módulo. */
export interface CuentaMeta {
  id: string;
  name: string;
  type: string;
  currency: "BOB" | "USD" | "USDT";
  is_liability: boolean;
}

/** Primera cuenta que coincide por tipo o por nombre, sobre la lista ya leída. */
function buscarCuenta(
  cuentas: CuentaMeta[],
  match: { type?: string; name?: string }
): CuentaMeta | undefined {
  return cuentas.find(
    (c) => (match.type ? c.type === match.type : true) && (match.name ? c.name === match.name : true)
  );
}

/**
 * `true` si la fecha existe y ya había ocurrido en el corte.
 * No se llama `hasta` a propósito: ese nombre ya lo usa el parámetro de fecha de
 * `calcularEstadoPatrimonio`, y tener las dos cosas con el mismo nombre es una
 * trampa para quien venga después.
 */
function yaOcurrio(fecha: string | null | undefined, corte: string): boolean {
  return !!fecha && fecha <= corte;
}

/**
 * Cuentas cuyo saldo se AUTOCALCULA (no se copia de la base):
 *  - DPF (Σ principal de los depósitos vigentes)
 *  - Por Cobrar (Σ saldo de las deudas aún no cobradas)
 *  - Activos (Σ valor de los activos que cuentan en patrimonio, en BOB)
 *
 * TODO se evalúa **a la fecha `corte`**, no a hoy. Antes se filtraba por el
 * `status` actual, así que regenerar la foto de un día pasado la contaminaba con
 * el estado presente: si cobrabas una deuda el día 6 y volvías a calcular el
 * día 3, «Por Cobrar» del día 3 perdía ese monto, que en esa fecha sí existía.
 * Como el usuario regenera días pasados, esto corrompía el historial.
 *
 * Cada fuente es resiliente: si su tabla/columna aún no existe (migración sin
 * aplicar), se omite y se conserva el saldo de la base para esa cuenta.
 */
export async function getCuentasDerivadas(
  db: SupabaseClient,
  userId: string,
  rate: number,
  corte: string,
  cuentas: CuentaMeta[]
): Promise<CuentaDerivada[]> {
  const out: CuentaDerivada[] = [];

  const cuentaDpf = buscarCuenta(cuentas, { type: "dpf" });
  const cuentaPorCobrar = buscarCuenta(cuentas, { type: "por_cobrar" });
  const cuentaActivos = buscarCuenta(cuentas, { name: "Activos" });

  // Las tres lecturas son independientes: en paralelo.
  const [rDpf, rDeudas, rActivos] = await Promise.allSettled([
    cuentaDpf
      ? db
          .from("dpf_deposits")
          .select("principal, start_date, end_date, status, paid_at")
          .eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
    cuentaPorCobrar
      ? db
          .from("debts")
          .select("amount, paid_amount, status, debt_date, collected_date")
          .eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
    cuentaActivos
      ? db
          .from("assets")
          .select("acquisition_cost, current_value, currency, acquired_date, sold_date, status, counts_in_patrimonio")
          .eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // DPF: vigente a la fecha = ya había empezado y aún no se había cobrado.
  const filasDpf = cuentaDpf ? filasDe<Record<string, unknown>>(rDpf, "los DPF") : null;
  if (cuentaDpf && filasDpf) {
    const value = redondear(
      filasDpf.reduce((s, d) => {
        const r = d as {
          principal: number;
          start_date: string | null;
          end_date: string | null;
          status: string;
          paid_at?: string | null;
        };
        // Aún no existía en esa fecha.
        if (r.start_date && r.start_date > corte) return s;
        // Ya se había cobrado. Si no hay fecha de cobro se usa el vencimiento,
        // que es cuando el dinero deja de estar inmovilizado.
        const liberado = r.paid_at ?? r.end_date;
        if (r.status === "pagado" && yaOcurrio(liberado, corte)) return s;
        return s + Number(r.principal);
      }, 0)
    );
    out.push({ accountId: cuentaDpf.id, label: "DPF", value });
  }

  // Por cobrar: saldo pendiente a la fecha.
  const filasDeudas = cuentaPorCobrar ? filasDe<Record<string, unknown>>(rDeudas, "las deudas") : null;
  if (cuentaPorCobrar && filasDeudas) {
    const value = redondear(
      filasDeudas.reduce((s, d) => {
        const r = d as {
          amount: number;
          paid_amount?: number;
          status: string;
          debt_date: string | null;
          collected_date?: string | null;
        };
        // El préstamo todavía no se había hecho.
        if (r.debt_date && r.debt_date > corte) return s;
        // Lo cobrado solo descuenta si el cobro ya había ocurrido. Sin fecha de
        // cobro se toma el estado actual, que es lo único que se sabe.
        const yaCobrado = r.collected_date ? r.collected_date <= corte : r.status === "pagado";
        const cobrado = yaCobrado ? Number(r.paid_amount ?? 0) : 0;
        return s + Math.max(0, Number(r.amount) - cobrado);
      }, 0)
    );
    out.push({ accountId: cuentaPorCobrar.id, label: "Por Cobrar", value });
  }

  // Activos: los que ya se habían adquirido y aún no se habían vendido.
  const filasActivos = cuentaActivos ? filasDe<Record<string, unknown>>(rActivos, "los activos") : null;
  if (cuentaActivos && filasActivos) {
    const value = redondear(
      filasActivos.reduce((s, a) => {
        const r = a as {
          acquisition_cost: number;
          current_value: number | null;
          currency: string;
          acquired_date: string | null;
          sold_date: string | null;
          status: string;
          counts_in_patrimonio: boolean;
        };
        if (!r.counts_in_patrimonio) return s;
        if (r.acquired_date && r.acquired_date > corte) return s;
        const yaVendido = r.sold_date ? r.sold_date <= corte : r.status === "vendido";
        if (yaVendido) return s;
        const val = r.current_value != null ? Number(r.current_value) : Number(r.acquisition_cost);
        return s + (r.currency === "BOB" ? val : val * rate);
      }, 0)
    );
    out.push({ accountId: cuentaActivos.id, label: "Activos", value });
  }

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
  corte: string,
  rate: number,
  monedaCuenta: Map<string, "BOB" | "USD" | "USDT">
): Promise<MovimientoPuntual[]> {
  const out: MovimientoPuntual[] = [];
  const aNativo = (bob: number, accId: string): number => {
    const cur = monedaCuenta.get(accId) ?? "BOB";
    return cur === "BOB" ? bob : rate ? bob / rate : 0;
  };

  // Las tres lecturas son independientes: en paralelo. `allSettled` mantiene la
  // tolerancia a que una columna aún no exista (migración sin aplicar) sin que
  // eso tumbe a las otras dos.
  const [rVentas, rPrestamos, rCobros] = await Promise.allSettled([
    db
      .from("assets")
      .select("sold_price, currency, sold_date, sold_account_id")
      .eq("user_id", userId)
      .eq("status", "vendido")
      .gt("sold_date", baseDate)
      .lte("sold_date", corte)
      .not("sold_account_id", "is", null),
    db
      .from("debts")
      .select("amount, debt_date, source_account_id")
      .eq("user_id", userId)
      .gt("debt_date", baseDate)
      .lte("debt_date", corte)
      .not("source_account_id", "is", null),
    db
      .from("debts")
      .select("paid_amount, collected_date, paid_account_id")
      .eq("user_id", userId)
      .gt("collected_date", baseDate)
      .lte("collected_date", corte)
      .not("paid_account_id", "is", null),
  ]);

  // Ventas de activos: ENTRA el precio de venta.
  for (const r of filasDe<Record<string, unknown>>(rVentas, "las ventas de activos") ?? []) {
    {
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
  }

  // Préstamos otorgados: SALE el monto prestado de la cuenta de origen.
  for (const r of filasDe<Record<string, unknown>>(rPrestamos, "los préstamos") ?? []) {
    {
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
  }

  // Cobros de deudas: ENTRA el monto cobrado.
  for (const r of filasDe<Record<string, unknown>>(rCobros, "los cobros") ?? []) {
    {
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
  }

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
  // La foto base y las cuentas no dependen entre sí: en paralelo.
  const [resBase, resCuentas] = await Promise.all([
    db
      .from("net_worth_snapshots")
      .select(
        "id, snapshot_date, snapshot_at, kind, exchange_rate, total_bob, net_worth_balances(account_id, amount, accounts(currency, is_liability))"
      )
      .eq("user_id", userId)
      .lte("snapshot_at", hastaISO)
      .order("snapshot_at", { ascending: false })
      .limit(1),
    db.from("accounts").select("id, name, type, currency, is_liability").eq("user_id", userId),
  ]);
  if (resBase.error) throw resBase.error;
  const fila = resBase.data?.[0] as Record<string, unknown> | undefined;
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

  // Una foto sin saldos no es una base válida: al arrancar de cero, el resultado
  // pierde TODAS las cuentas reales y solo quedan las derivadas, dando un
  // patrimonio muy por debajo del real. Puede ocurrir con una fila huérfana (un
  // alta que no llegó a guardar sus saldos). Mejor fallar con un mensaje claro
  // que escribir esa cifra en el historial.
  if (balancesBase.length === 0) {
    throw new Error(
      `La foto del ${base.snapshot_date} no tiene saldos: no sirve como base. ` +
        "Bórrala desde Registros y vuelve a intentarlo."
    );
  }

  // El total de la base se recalcula SIEMPRE desde sus saldos: la foto nueva se
  // arma a partir de ellos, así que tomar un total almacenado que no cuadre haría
  // que la explicación contradijera al detalle.
  const baseTotalBob = calcularTotalBob(balancesBase, rate);

  // Cuentas: moneda, tipo y si son pasivo. Se leen UNA vez y se reutilizan;
  // antes se volvían a consultar tres veces más, una por cuenta derivada.
  // Sin las cuentas no se sabe la moneda de cada saldo y todo se valuaría como
  // BOB: un fallo aquí daría un total miles de bolivianos por debajo del real,
  // y el job lo guardaría como verdad. Es un error fatal, no algo que tolerar.
  if (resCuentas.error) {
    throw new Error(
      `No se pudieron leer las cuentas: ${(resCuentas.error as { message?: string }).message ?? resCuentas.error}`
    );
  }
  const cuentas = (resCuentas.data ?? []) as CuentaMeta[];
  if (cuentas.length === 0) {
    throw new Error("No hay cuentas: no se puede valuar el patrimonio por moneda.");
  }
  const metaCuenta = new Map(
    cuentas.map((r) => [
      r.id,
      { name: r.name, type: r.type, currency: r.currency, is_liability: !!r.is_liability },
    ])
  );
  // Gastos e ingresos posteriores a la base, repartidos CUENTA POR CUENTA.
  const rango = rangoTransacciones(base, hasta);
  const monedaCuenta = new Map([...metaCuenta].map(([id, m]) => [id, m.currency] as const));

  // Las tres lecturas restantes no dependen entre sí: en paralelo. En secuencia
  // eran tres viajes encadenados en cada carga del dashboard.
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
  const { data: txns, error: eTx } = resTxns;
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
      name: metaCuenta.get(account_id)?.name ?? "—",
      type: metaCuenta.get(account_id)?.type ?? "otro",
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


/** Dinero disponible ya (efectivo, banco, stablecoins), en BOB. */
export function disponibilidadDe(estado: EstadoPatrimonio): number {
  const liquido = estado.balances.reduce((acc, b) => {
    if (b.account.is_liability || !TIPOS_LIQUIDOS.has(b.account.type)) return acc;
    return acc + (b.account.currency === "BOB" ? b.amount : b.amount * estado.rate);
  }, 0);
  return redondear(liquido);
}

/** Valor en BOB por moneda, para la barra de distribución. */
export function distribucionMonedaDe(estado: EstadoPatrimonio): {
  BOB: number;
  USD: number;
  USDT: number;
} {
  const out = { BOB: 0, USD: 0, USDT: 0 };
  for (const b of estado.balances) {
    if (b.account.is_liability) continue;
    const bob = b.account.currency === "BOB" ? b.amount : b.amount * estado.rate;
    out[b.account.currency] += bob;
  }
  return { BOB: redondear(out.BOB), USD: redondear(out.USD), USDT: redondear(out.USDT) };
}
