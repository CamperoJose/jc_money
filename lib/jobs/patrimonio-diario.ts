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
 * Total = total de la base + (ingresos − gastos) ocurridos DESPUÉS de esa base
 * y hasta las 23:59 del día + ajustes de cuentas derivadas (DPF, Por Cobrar,
 * Activos) y movimientos (ventas/cobros). Contar "desde el último registro"
 * evita duplicar lo que la base ya reflejaba: si la base es el cierre del día
 * anterior equivale al día entero; si es un manual del mismo día, solo cuenta lo
 * posterior. Los saldos de la base se copian para conservar la composición.
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
  // targetDate. Puede ser un manual del MISMO día (p. ej. un recálculo que hiciste
  // por la tarde): en ese caso el neto solo cuenta lo ocurrido DESPUÉS de esa foto.
  const { data: bases, error: eBase } = await admin
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, snapshot_at, exchange_rate, kind, total_bob, net_worth_balances(account_id, amount, accounts(currency, is_liability))"
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

  // Total base: para auto se confía en el almacenado; para manual se recalcula.
  const baseTotalBob =
    base.kind === "auto" && base.total_bob != null
      ? Number(base.total_bob)
      : calcularTotalBob(balancesBase, rate);

  // Neto del DÍA ENTERO que se procesa (targetDate): TODOS los gastos/ingresos
  // Neto = lo ocurrido DESPUÉS del último registro (base) y hasta el cierre del
  // targetDate (23:59). Así NO se duplica lo que la base ya reflejaba:
  //  - si la base es el cierre del día anterior → cuenta el día entero;
  //  - si la base es un manual del mismo día → cuenta solo lo posterior a él
  //    (un gasto hecho ANTES del recálculo manual ya está dentro del manual y no
  //    se vuelve a restar). Ingresos suman, gastos restan (BOB, con el T/C de cada txn).
  const baseAtISO = base.snapshot_at as string;
  const { data: txns, error: eTx } = await admin
    .from("transactions")
    .select("type, amount, currency, exchange_rate")
    .eq("user_id", userId)
    .gt("occurred_at", baseAtISO)
    .lte("occurred_at", targetAtISO);
  if (eTx) throw eTx;

  let netoDia = 0;
  for (const t of txns ?? []) {
    const amount = Number(t.amount);
    const enBob = t.currency === "BOB" ? amount : amount * (Number(t.exchange_rate) || 0);
    netoDia += t.type === "ingreso" ? enBob : -enBob;
  }
  netoDia = redondear(netoDia);

  // Cuentas derivadas (DPF, Por Cobrar, Activos): su saldo se AUTOCALCULA (no se
  // copia de la base). El resto de cuentas se copian tal cual. El ajuste al total
  // = Σ (valor autocalculado − saldo que traía la base) por cada cuenta derivada.
  const derivadas = await getCuentasDerivadas(admin, userId, rate);
  const overrides = new Map(derivadas.map((d) => [d.accountId, d.value]));
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
    .select("id, currency")
    .eq("user_id", userId);
  const monedaCuenta = new Map(
    (cuentasData ?? []).map((c) => [
      (c as { id: string }).id,
      (c as { currency: "BOB" | "USD" | "USDT" }).currency,
    ])
  );
  const movimientos = await getMovimientosDelDia(
    admin,
    userId,
    base.snapshot_date as string,
    targetDate,
    rate,
    monedaCuenta
  );
  const incrementos = new Map<string, number>();
  let ajusteMovimientos = 0;
  for (const m of movimientos) {
    ajusteMovimientos += m.proceedsBob;
    incrementos.set(m.destAccountId, redondear((incrementos.get(m.destAccountId) ?? 0) + m.destIncrement));
  }
  ajusteMovimientos = redondear(ajusteMovimientos);

  const totalBob = redondear(baseTotalBob + netoDia + ajusteDerivadas + ajusteMovimientos);
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
        `${netoDia >= 0 ? "+" : "−"} ${Math.abs(netoDia)} de neto desde el último registro` +
        (derivadas.length ? ` ${ajusteDerivadas >= 0 ? "+" : "−"} ${Math.abs(ajusteDerivadas)} de ajuste derivadas (${detalleDerivadas})` : "") +
        (movimientos.length ? ` + ${ajusteMovimientos} de movimientos (${detalleMovimientos})` : "") +
        ".",
    })
    .select("id")
    .single();
  if (eIns) throw eIns;
  const snapId = snap.id as string;

  // Copia los saldos de la base, pero reemplaza los de las cuentas derivadas por
  // su valor autocalculado. OJO: con la service role el default `auth.uid()` no
  // aplica, así que el user_id debe ir explícito en cada fila (RLS not-null).
  const filas = balancesBase.map((b) => {
    let amount = overrides.has(b.account_id) ? overrides.get(b.account_id)! : b.amount;
    if (incrementos.has(b.account_id)) amount = redondear(amount + incrementos.get(b.account_id)!);
    return { user_id: userId, snapshot_id: snapId, account_id: b.account_id, amount };
  });
  // Agrega las cuentas derivadas que la base no tenía.
  for (const d of derivadas) {
    if (!balancesBase.some((b) => b.account_id === d.accountId)) {
      filas.push({ user_id: userId, snapshot_id: snapId, account_id: d.accountId, amount: d.value });
    }
  }
  // Agrega cuentas destino de movimientos que la base no tenía (ni son derivadas).
  for (const [accId, inc] of incrementos) {
    if (
      !balancesBase.some((b) => b.account_id === accId) &&
      !derivadas.some((d) => d.accountId === accId)
    ) {
      filas.push({ user_id: userId, snapshot_id: snapId, account_id: accId, amount: inc });
    }
  }
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
    ajuste_derivadas_bob: derivadas.length ? ajusteDerivadas : undefined,
    derivadas: derivadas.length ? Object.fromEntries(derivadas.map((d) => [d.label, d.value])) : undefined,
    ajuste_movimientos_bob: movimientos.length ? ajusteMovimientos : undefined,
    movimientos: movimientos.length ? movimientos.map((m) => `${m.label}=${m.proceedsBob}`) : undefined,
    total_bob: totalBob,
  };
}
