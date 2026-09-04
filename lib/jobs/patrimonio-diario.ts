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
  /** Parte del neto del día que no se pudo atribuir a ninguna cuenta. */
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

interface CuentaDerivada {
  accountId: string;
  label: string;
  value: number;
}

/** Busca el id de una cuenta por tipo o por nombre. */
async function cuentaIdPor(
  admin: SupabaseClient,
  userId: string,
  match: { type?: string; name?: string }
): Promise<string | null> {
  let q = admin.from("accounts").select("id").eq("user_id", userId);
  if (match.type) q = q.eq("type", match.type);
  if (match.name) q = q.eq("name", match.name);
  const { data } = await q.order("created_at", { ascending: true }).limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Cuentas cuyo saldo el job AUTOCALCULA (no las copia de la base):
 *  - DPF (Σ principal de DPF activos)
 *  - Por Cobrar (Σ saldo de deudas no pagadas)
 *  - Activos (Σ valor de activos que cuentan en patrimonio, en BOB)
 * Cada fuente es resiliente: si su tabla/columna aún no existe (migración sin
 * aplicar), se omite y el job conserva el saldo de la base para esa cuenta.
 */
async function getCuentasDerivadas(
  admin: SupabaseClient,
  userId: string,
  rate: number
): Promise<CuentaDerivada[]> {
  const out: CuentaDerivada[] = [];

  // DPF
  try {
    const accountId = await cuentaIdPor(admin, userId, { type: "dpf" });
    if (accountId) {
      const { data, error } = await admin
        .from("dpf_deposits")
        .select("principal")
        .eq("user_id", userId)
        .eq("status", "activo");
      if (error) throw error;
      const value = redondear((data ?? []).reduce((s, d) => s + Number((d as { principal: number }).principal), 0));
      out.push({ accountId, label: "DPF", value });
    }
  } catch { /* tabla no lista: se omite */ }

  // Por Cobrar (deudas)
  try {
    const accountId = await cuentaIdPor(admin, userId, { type: "por_cobrar" });
    if (accountId) {
      const { data, error } = await admin
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

  // Activos
  try {
    const accountId = await cuentaIdPor(admin, userId, { name: "Activos" });
    if (accountId) {
      const { data, error } = await admin
        .from("assets")
        .select("acquisition_cost, current_value, currency")
        .eq("user_id", userId)
        .eq("status", "activo")
        .eq("counts_in_patrimonio", true);
      if (error) throw error;
      const value = redondear(
        (data ?? []).reduce((s, a) => {
          const r = a as { acquisition_cost: number; current_value: number | null; currency: string };
          const val = r.current_value != null ? Number(r.current_value) : Number(r.acquisition_cost);
          return s + (r.currency === "BOB" ? val : val * rate);
        }, 0)
      );
      out.push({ accountId, label: "Activos", value });
    }
  } catch { /* tabla no lista: se omite */ }

  return out;
}

interface MovimientoDia {
  label: string;
  destAccountId: string;
  proceedsBob: number; // aporte al total (BOB)
  destIncrement: number; // incremento en la cuenta destino (moneda nativa)
}

/**
 * Movimientos puntuales que ingresan dinero a una cuenta destino y cuyo evento
 * cae DESPUÉS de la base y hasta `targetDate` (se inyecta una sola vez, el día
 * que el cierre cruza el evento; luego el saldo queda copiado de la base):
 *   - Venta de activos → precio de venta a la cuenta destino (`sold_account_id`).
 *   - Cobro de deudas  → monto cobrado a la cuenta destino (`paid_account_id`).
 * El activo/deuda ya salió de su cuenta derivada (Activos / Por Cobrar), así que
 * el efecto neto en patrimonio es exactamente el resultado realizado (venta) o
 * cero (un cobro solo mueve valor de «por cobrar» a una cuenta real).
 * Resiliente: si la columna aún no existe (migración sin aplicar), se omite.
 */
async function getMovimientosDelDia(
  admin: SupabaseClient,
  userId: string,
  baseDate: string,
  targetDate: string,
  rate: number,
  monedaCuenta: Map<string, "BOB" | "USD" | "USDT">
): Promise<MovimientoDia[]> {
  const out: MovimientoDia[] = [];
  const aNativo = (bob: number, accId: string): number => {
    const cur = monedaCuenta.get(accId) ?? "BOB";
    return cur === "BOB" ? bob : rate ? bob / rate : 0;
  };

  // Ventas de activos (precio en la moneda del activo → BOB).
  try {
    const { data, error } = await admin
      .from("assets")
      .select("sold_price, currency, sold_date, sold_account_id")
      .eq("user_id", userId)
      .eq("status", "vendido")
      .gt("sold_date", baseDate)
      .lte("sold_date", targetDate)
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

  // Cobros de deudas (monto cobrado en BOB → cuenta destino).
  try {
    const { data, error } = await admin
      .from("debts")
      .select("paid_amount, collected_date, paid_account_id")
      .eq("user_id", userId)
      .gt("collected_date", baseDate)
      .lte("collected_date", targetDate)
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
 * Crea la foto de patrimonio AUTOCALCULADA que cierra el día `targetDate`
 * (por defecto, ayer en Bolivia), fechada a las 23:59 de ese día.
 *
 * Base = EL ÚLTIMO REGISTRO (manual o auto), la última foto que exista ≤ 23:59
 * del targetDate (no se asume "el día anterior").
 * Los saldos se arman cuenta por cuenta: se copian los de la base, se reemplazan
 * los de las cuentas derivadas (DPF, Por Cobrar, Activos) por su valor
 * autocalculado, se suman los movimientos del día (ventas de activos, cobros de
 * deudas) y se aplica el neto del DÍA ENTERO procesado (todos los gastos e
 * ingresos del targetDate, sin importar la hora) SOBRE LA CUENTA DE CADA
 * MOVIMIENTO. Los gastos son independientes del patrimonio y solo lo impactan
 * aquí: el manual son saldos en bruto y el job aplica encima los gastos del día.
 * El total se calcula DESDE esos saldos, no sumando piezas por separado, para
 * que siempre valga total = Σ(saldos) y el diff por cuenta explique el cambio
 * completo.
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
  // pueden coexistir con la automática (puede haber manual(es) + una auto por día).
  const { data: yaAuto, error: eDup } = await admin
    .from("net_worth_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "auto")
    .eq("snapshot_date", targetDate)
    .limit(1);
  if (eDup) throw eDup;
  if (yaAuto && yaAuto.length > 0) {
    return { ok: true, skipped: true, reason: `Ya existe una foto auto para ${targetDate}.`, target_date: targetDate };
  }

  // Base = EL ÚLTIMO REGISTRO (manual o auto) en o antes de las 23:59 del
  // targetDate (no se asume "el día anterior"). Sobre esa base se aplica el neto
  // del día entero.
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

  // T/C del cierre automático: se conserva el de la base (que desciende de la
  // última foto manual, cuyo T/C se autollena del BCB pero es editable). Así el
  // cierre auto no altera en silencio la valuación histórica del patrimonio.
  const rate = Number(base.exchange_rate);
  const balancesBase = ((base.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    account_id: b.account_id as string,
    amount: Number(b.amount),
    account: b.accounts as { currency: "BOB" | "USD" | "USDT"; is_liability: boolean },
  }));

  // Total base: SIEMPRE recalculado desde los saldos de la base. La foto nueva se
  // arma a partir de esos saldos, así que tomar el total almacenado (que en fotos
  // auto antiguas podía no cuadrar con Σ saldos) haría que la nota contradijera
  // al detalle. Recalcular también sana ese desfase hacia adelante.
  const baseTotalBob = calcularTotalBob(balancesBase, rate);

  // Neto del DÍA ENTERO que se procesa (targetDate): TODOS los gastos/ingresos
  // Neto = TODOS los gastos/ingresos del DÍA ENTERO procesado (targetDate), sin
  // importar la hora ni la del registro base. En este modelo los gastos son
  // independientes del patrimonio y solo lo impactan aquí (vía el job): el
  // recálculo manual son saldos "en bruto" y el job aplica encima los gastos del
  // día. Ingresos suman, gastos restan (en BOB, con el T/C de cada txn).
  const { data: txns, error: eTx } = await admin
    .from("transactions")
    .select("type, amount, currency, exchange_rate, account_id")
    .eq("user_id", userId)
    .eq("txn_date", targetDate);
  if (eTx) throw eTx;

  // Cuentas derivadas (DPF, Por Cobrar, Activos): su saldo se AUTOCALCULA (no se
  // copia de la base). El resto de cuentas se copian tal cual. El ajuste al total
  // = Σ (valor autocalculado − saldo que traía la base) por cada cuenta derivada.
  const derivadas = await getCuentasDerivadas(admin, userId, rate);
  let ajusteDerivadas = 0;
  for (const d of derivadas) {
    const enBase = balancesBase.find((b) => b.account_id === d.accountId)?.amount ?? 0;
    ajusteDerivadas += d.value - enBase;
  }
  ajusteDerivadas = redondear(ajusteDerivadas);

  // Movimientos puntuales (ventas de activos, cobros de deudas) que ingresan a
  // una cuenta destino el día del evento. Requieren la moneda de cada cuenta.
  const { data: cuentasData } = await admin
    .from("accounts")
    .select("id, currency, is_liability")
    .eq("user_id", userId);
  const metaCuenta = new Map(
    (cuentasData ?? []).map((c) => {
      const r = c as { id: string; currency: "BOB" | "USD" | "USDT"; is_liability: boolean };
      return [r.id, { currency: r.currency, is_liability: !!r.is_liability }];
    })
  );
  const monedaCuenta = new Map(
    [...metaCuenta].map(([id, m]) => [id, m.currency] as const)
  );
  const movimientos = await getMovimientosDelDia(
    admin,
    userId,
    base.snapshot_date as string,
    targetDate,
    rate,
    monedaCuenta
  );

  // Reparte el neto del día CUENTA POR CUENTA (en la moneda de cada cuenta).
  // Antes el neto se restaba solo del total y los saldos se copiaban intactos:
  // el total bajaba pero ninguna cuenta lo reflejaba, así que Σ(saldos) ≠ total
  // y el diff por cuenta no mostraba los gastos. Un gasto baja el saldo de su
  // cuenta (o lo sube si la cuenta es un pasivo, porque aumenta la deuda).
  const deltaPorCuenta = new Map<string, number>();
  let netoSinCuentaBob = 0; // gastos/ingresos sin cuenta asignada (no atribuibles)
  let netoDia = 0;
  for (const t of txns ?? []) {
    const amount = Number(t.amount);
    if (!Number.isFinite(amount)) continue;
    const enBob = t.currency === "BOB" ? amount : amount * (Number(t.exchange_rate) || 0);
    const signo = t.type === "ingreso" ? 1 : -1;
    netoDia += signo * enBob;

    const accId = (t as { account_id: string | null }).account_id;
    const meta = accId ? metaCuenta.get(accId) : undefined;
    if (!accId || !meta) {
      netoSinCuentaBob += signo * enBob;
      continue;
    }
    // Monto en la moneda de la cuenta: directo si coincide, si no vía BOB.
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
  netoDia = redondear(netoDia);
  netoSinCuentaBob = redondear(netoSinCuentaBob);
  const incrementos = new Map<string, number>();
  let ajusteMovimientos = 0;
  for (const m of movimientos) {
    ajusteMovimientos += m.proceedsBob;
    incrementos.set(m.destAccountId, redondear((incrementos.get(m.destAccountId) ?? 0) + m.destIncrement));
  }
  ajusteMovimientos = redondear(ajusteMovimientos);

  // Saldos resultantes = base + overrides de derivadas + movimientos + neto del
  // día repartido por cuenta. El total se calcula DESDE estos saldos, de modo que
  // siempre se cumpla la invariante total = Σ(saldos) y el diff por cuenta
  // explique el cambio completo.
  const saldos = new Map<string, number>();
  for (const b of balancesBase) saldos.set(b.account_id, b.amount);
  for (const d of derivadas) saldos.set(d.accountId, d.value);
  for (const [accId, inc] of incrementos) {
    saldos.set(accId, redondear((saldos.get(accId) ?? 0) + inc));
  }
  for (const [accId, delta] of deltaPorCuenta) {
    saldos.set(accId, redondear((saldos.get(accId) ?? 0) + delta));
  }

  const balancesFinales = [...saldos].map(([account_id, amount]) => ({
    account_id,
    amount,
    account: {
      currency: metaCuenta.get(account_id)?.currency ?? "BOB",
      is_liability: metaCuenta.get(account_id)?.is_liability ?? false,
    },
  }));

  // netoSinCuentaBob: movimientos sin cuenta asignada. No se pueden reflejar en
  // ningún saldo, así que se suman aparte y se declaran en la nota.
  const totalBob = redondear(calcularTotalBob(balancesFinales, rate) + netoSinCuentaBob);
  const totalUsd = rate ? redondear(totalBob / rate) : null;

  const detalleDerivadas = derivadas.map((d) => `${d.label}=${d.value}`).join(", ");
  const detalleMovimientos = movimientos.map((m) => `${m.label}=${m.proceedsBob}`).join(", ");

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
      note:
        `Autocalculado: base del ${base.snapshot_date} (${baseTotalBob}) ` +
        `${netoDia >= 0 ? "+" : "−"} ${Math.abs(netoDia)} de neto del día` +
        (derivadas.length ? ` ${ajusteDerivadas >= 0 ? "+" : "−"} ${Math.abs(ajusteDerivadas)} de ajuste derivadas (${detalleDerivadas})` : "") +
        (movimientos.length ? ` + ${ajusteMovimientos} de movimientos (${detalleMovimientos})` : "") +
        (netoSinCuentaBob !== 0 ? ` (incluye ${netoSinCuentaBob} sin cuenta asignada)` : "") +
        ".",
    })
    .select("id")
    .single();
  if (eIns) throw eIns;
  const snapId = snap.id as string;

  // Guarda los saldos ya calculados (base + derivadas + movimientos + neto del
  // día por cuenta). OJO: con la service role el default `auth.uid()` no aplica,
  // así que el user_id debe ir explícito en cada fila (RLS not-null).
  const filas = balancesFinales.map((b) => ({
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
    neto_sin_cuenta_bob: netoSinCuentaBob || undefined,
    ajuste_derivadas_bob: derivadas.length ? ajusteDerivadas : undefined,
    derivadas: derivadas.length ? Object.fromEntries(derivadas.map((d) => [d.label, d.value])) : undefined,
    ajuste_movimientos_bob: movimientos.length ? ajusteMovimientos : undefined,
    movimientos: movimientos.length ? movimientos.map((m) => `${m.label}=${m.proceedsBob}`) : undefined,
    total_bob: totalBob,
  };
}
