import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo, leerConfigCorreo } from "@/lib/mailer";
import {
  htmlPatrimonioDiario,
  htmlDpfAlerta,
  htmlResumenSemanal,
  htmlReporteMensual,
  htmlAlertaPresupuesto,
  htmlDeudasVencidas,
  type AlertaPresupuestoItem,
  type DeudaVencidaItem,
  type PatrimonioEmailData,
  type DpfAlertaItem,
} from "@/lib/emails/plantillas";
import { getDpfs } from "@/lib/queries/dpf";
import { TIPOS_LIQUIDOS } from "@/lib/patrimonio";
import { resumenDpf, type ResumenDpf } from "@/lib/dpf";
import { getResumenPresupuestos } from "@/lib/queries/presupuestos";
import { getResumenDeudas } from "@/lib/queries/deudas";
import {
  leerAviso,
  guardarAviso,
  nivelDeEstado,
  decidirAvisoPresupuesto,
  decidirAvisoDeudas,
} from "@/lib/jobs/avisos";

export interface ResultadoCorreos {
  ok: boolean;
  reason?: string;
  patrimonio_enviado?: boolean;
  alerta_enviada?: boolean;
  dpf_vencen_hoy?: number;
  semanal_enviado?: boolean;
  mensual_enviado?: boolean;
  alerta_presupuesto?: number; // categorías avisadas (0 = no se envió correo)
  alerta_deudas?: number; // deudas vencidas avisadas (0 = no se envió correo)
}

/** Día de la semana (0=Dom … 1=Lun) de una fecha 'YYYY-MM-DD'. */
function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}
/** Último día real del mes de un periodo 'YYYY-MM', como 'YYYY-MM-DD'. */
function ultimoDiaDelMes(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
/** Días calendario entre dos fechas 'YYYY-MM-DD' (b − a). */
function diasEntreISO(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
function sumarDiasISO(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function periodoAnterior(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}


async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  for (const t of ["net_worth_snapshots", "accounts", "app_settings", "transactions"]) {
    const { data, error } = await admin.from(t).select("user_id").limit(1);
    if (error) throw error;
    if (data && data.length > 0) return (data[0] as { user_id: string }).user_id;
  }
  return null;
}

interface BalRow {
  amount: number;
  account: { name: string; type: string; currency: string; is_liability: boolean };
}

/**
 * Envía el correo diario de patrimonio (mini-dash) y, si algún DPF vence hoy,
 * un correo aparte de alerta. Requiere SMTP_USER/SMTP_PASS en el entorno.
 */
export async function ejecutarCorreos(
  admin: SupabaseClient,
  opts?: { targetDate?: string }
): Promise<ResultadoCorreos> {
  if (!leerConfigCorreo()) {
    return { ok: false, reason: "Faltan SMTP_USER/SMTP_PASS: no se envían correos." };
  }
  const hoy = opts?.targetDate ?? fechaBoliviaHoy();

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  // Últimas 2 fotos con sus balances y cuentas.
  const { data: snaps, error: eSnap } = await admin
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, exchange_rate, total_bob, total_usd, net_worth_balances(amount, accounts(name, type, currency, is_liability))"
    )
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .limit(2);
  if (eSnap) throw eSnap;

  const last = snaps?.[0] as Record<string, unknown> | undefined;
  if (!last) return { ok: false, reason: "No hay fotos de patrimonio para el correo." };
  const prev = snaps?.[1] as Record<string, unknown> | undefined;

  const rate = Number(last.exchange_rate) || 0;
  const balances: BalRow[] = ((last.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    amount: Number(b.amount),
    account: b.accounts as BalRow["account"],
  }));
  const bob = (b: BalRow) => (b.account.currency === "BOB" ? b.amount : b.amount * rate);

  const disponibilidad = round2(
    balances.filter((b) => !b.account.is_liability && TIPOS_LIQUIDOS.has(b.account.type)).reduce((s, b) => s + bob(b), 0)
  );
  const porCobrar = saldoCuenta(balances, (a) => a.type === "por_cobrar", bob);
  const activos = saldoCuenta(balances, (a) => a.name === "Activos", bob);

  const totalBob = Number(last.total_bob) || 0;
  const totalUsd = last.total_usd != null ? Number(last.total_usd) : rate ? round2(totalBob / rate) : 0;
  const prevTotal = prev?.total_bob != null ? Number(prev.total_bob) : null;
  const deltaBob = prevTotal != null ? round2(totalBob - prevTotal) : null;
  const deltaPct = prevTotal && prevTotal > 0 && deltaBob != null ? deltaBob / prevTotal : null;

  // Detalle DPF (tolerante a migraciones no aplicadas). Se reutiliza en semanal/mensual.
  let dpfData: PatrimonioEmailData["dpf"] = null;
  let vencenHoy: DpfAlertaItem[] = [];
  let rDpf: ResumenDpf | null = null;
  try {
    const deposits = await getDpfs(admin);
    const r = resumenDpf(deposits, hoy);
    rDpf = r;
    const prox = r.proximo;
    dpfData = {
      capital: r.montoEnDpf,
      gananciaLiquida: r.gananciaLiquida,
      proxima: prox
        ? {
            titulo: prox.pizarra || prox.id_dpf_externo || "DPF",
            fecha: prox.end_date,
            monto: prox.montoAlVencimiento,
            dias: prox.diasRestantes,
          }
        : null,
    };
    vencenHoy = r.dpfs
      .filter((d) => d.status === "activo" && d.end_date === hoy)
      .map((d) => ({
        titulo: d.pizarra || d.id_dpf_externo || "DPF",
        fecha: d.end_date,
        capital: d.principal,
        montoAlVencimiento: d.montoAlVencimiento,
        ganancia: d.interesLiquido,
        tasa: d.annual_rate,
      }));
  } catch {
    dpfData = null;
  }

  // Resumen de los movimientos del día que se cierra: cuánto se gastó, cuántos
  // fueron y en qué categorías. Es lo primero que se quiere saber por la mañana.
  let dia: PatrimonioEmailData["dia"] = null;
  try {
    const { data: txns, error: eTx } = await admin
      .from("transactions")
      .select("type, amount, currency, exchange_rate, categories(name)")
      .eq("user_id", userId)
      .eq("txn_date", hoy);
    if (eTx) throw eTx;
    let gastos = 0;
    let ingresos = 0;
    const porCat = new Map<string, number>();
    for (const t of txns ?? []) {
      // El embebido de PostgREST llega como array o como objeto según la
      // relación; se normaliza a un nombre.
      const r = t as unknown as {
        type: string;
        amount: number;
        currency: string;
        exchange_rate: number | null;
        categories?: { name: string } | { name: string }[] | null;
      };
      const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
      const monto = Number(r.amount);
      const enBob = r.currency === "BOB" ? monto : monto * (Number(r.exchange_rate) || 0);
      if (r.type === "ingreso") {
        ingresos += enBob;
      } else {
        gastos += enBob;
        const nombre = cat?.name ?? "Sin categoría";
        porCat.set(nombre, (porCat.get(nombre) ?? 0) + enBob);
      }
    }
    dia = {
      gastos: round2(gastos),
      ingresos: round2(ingresos),
      neto: round2(ingresos - gastos),
      cantidad: (txns ?? []).length,
      porCategoria: [...porCat]
        .map(([nombre, monto]) => ({ nombre, monto: round2(monto) }))
        .sort((a, b) => b.monto - a.monto),
    };
  } catch {
    // Si algo falla al resumir el día, el correo sale igual con el patrimonio.
    dia = null;
  }

  // 1) Correo de patrimonio.
  const data: PatrimonioEmailData = {
    fecha: last.snapshot_date as string,
    totalBob,
    totalUsd,
    tc: rate,
    deltaBob,
    deltaPct,
    disponibilidad,
    porCobrar,
    activos,
    dpf: dpfData,
    dia,
  };
  const patri = htmlPatrimonioDiario(data);
  await enviarCorreo({ subject: patri.subject, html: patri.html, text: patri.text });

  // 2) Correo de alerta de DPF (solo si vence alguno hoy).
  let alertaEnviada = false;
  if (vencenHoy.length > 0) {
    const alerta = htmlDpfAlerta(vencenHoy, hoy);
    await enviarCorreo({ subject: alerta.subject, html: alerta.html, text: alerta.text });
    alertaEnviada = true;
  }

  // 3) Alerta de presupuesto. Se avisa al cruzar 85% y otra vez al pasar el
  //     100%, una sola vez por nivel y categoría en el mes: si no, el mismo
  //     correo llegaría todos los días hasta fin de mes y se dejaría de leer.
  let alertaPresupuesto = 0;
  try {
    const period = hoy.slice(0, 7);
    const rp = await getResumenPresupuestos(admin, period);
    const claveP = `aviso_presupuesto:${period}`;
    const avisados = (await leerAviso<Record<string, number>>(admin, userId, claveP)) ?? {};

    const { nuevas: nuevos, marcas } = decidirAvisoPresupuesto<AlertaPresupuestoItem>(
      rp.filas
        .filter((f) => f.planned > 0)
        .map((f) => ({
          categoryId: f.category_id,
          nivel: nivelDeEstado(f.estado),
          dato: {
            categoria: f.category_name,
            planeado: f.planned,
            gastado: f.spent,
            pct: f.pct,
            nivel: f.estado === "excedido" ? ("excedido" as const) : ("alerta" as const),
          },
        })),
      avisados
    );

    if (nuevos.length > 0) {
      const al = htmlAlertaPresupuesto(nuevos, period);
      await enviarCorreo({ subject: al.subject, html: al.html, text: al.text });
      await guardarAviso(admin, userId, claveP, marcas);
      alertaPresupuesto = nuevos.length;
    }
  } catch {
    // Sin presupuestos o con la migración a medias: el resto de correos sigue.
  }

  // 4) Recordatorio de deudas por cobrar vencidas. Como una deuda vencida sigue
  //    vencida mañana, se repite a lo sumo una vez por semana; pero si aparece
  //    una deuda vencida nueva, se avisa el mismo día.
  let alertaDeudas = 0;
  try {
    const rd = await getResumenDeudas(admin);
    const vencidas = rd.deudas.filter((d) => d.vencida && d.outstanding > 0);
    if (vencidas.length > 0) {
      const claveD = "aviso_deudas_vencidas";
      const previo = await leerAviso<{ fecha: string; ids: string[] }>(admin, userId, claveD);
      const ids = vencidas.map((d) => d.id).sort();

      if (decidirAvisoDeudas(ids, previo, hoy)) {
        const items: DeudaVencidaItem[] = vencidas.map((d) => ({
          quien: d.counterparty || "Sin nombre",
          monto: d.outstanding,
          vence: d.due_date ?? "",
          dias: d.diasVencida ?? 0,
          motivo: d.reason,
        }));
        const al = htmlDeudasVencidas(items);
        await enviarCorreo({ subject: al.subject, html: al.html, text: al.text });
        await guardarAviso(admin, userId, claveD, { fecha: hoy, ids });
        alertaDeudas = items.length;
      }
    } else {
      await guardarAviso(admin, userId, "aviso_deudas_vencidas", null);
    }
  } catch {
    // Sin deudas o migración a medias: el resto de correos sigue.
  }

  // 5) Correos periódicos: semanal (lunes) y mensual (el día 1, sobre el mes
  //    que acaba de cerrar). Antes el mensual salía el primer lunes, así que un
  //    cierre de agosto podía llegar el 7 de septiembre y leerse como atrasado.
  let semanalEnviado = false;
  let mensualEnviado = false;
  const esLunes = diaSemana(hoy) === 1;
  const esPrimerDiaDelMes = hoy.slice(8, 10) === "01";

  if (esLunes || esPrimerDiaDelMes) {
    // El periodo sale de la fecha que se está procesando, NO de la de hoy: si
    // el job se reejecuta para un día pasado tiene que reportar aquel mes.
    const period = hoy.slice(0, 7);
    const prevPeriod = periodoAnterior(period);

    // Historial de patrimonio para deltas (valor a una fecha = última foto ≤ fecha).
    const { data: hist } = await admin
      .from("net_worth_snapshots")
      .select("snapshot_date, total_bob")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: true });
    const historial = (hist ?? []).map((h) => ({
      fecha: h.snapshot_date as string,
      total: Number(h.total_bob),
    }));
    // Valor del patrimonio a una fecha = última foto ≤ esa fecha, pero solo si
    // no está demasiado atrás: comparar contra una foto de hace meses daba
    // "0,00 (0,0%)" con flecha verde, como si el patrimonio no se hubiera
    // movido, cuando en realidad no había con qué comparar.
    const MAX_ATRASO_DIAS = 45;
    const valorEn = (f: string): number | null => {
      let ultima: { fecha: string; total: number } | null = null;
      for (const h of historial) if (h.fecha <= f) ultima = h;
      if (!ultima) return null;
      return diasEntreISO(ultima.fecha, f) <= MAX_ATRASO_DIAS ? ultima.total : null;
    };

    // Transacciones desde el inicio del mes anterior (cubre semanal y mensual).
    const { data: txs } = await admin
      .from("transactions")
      .select("type, amount, currency, exchange_rate, txn_date, categories(name)")
      .eq("user_id", userId)
      .gte("txn_date", `${prevPeriod}-01`);
    const filas = (txs ?? []) as Record<string, unknown>[];
    const txBob = (t: Record<string, unknown>) => {
      const a = Number(t.amount);
      return t.currency === "BOB" ? a : a * (Number(t.exchange_rate) || 0);
    };
    const catNombre = (t: Record<string, unknown>) =>
      ((t.categories as { name?: string } | null)?.name) || "Sin categoría";
    const top = (items: Record<string, unknown>[], n: number) => {
      const m = new Map<string, number>();
      for (const t of items) m.set(catNombre(t), (m.get(catNombre(t)) ?? 0) + txBob(t));
      return [...m.entries()].map(([nombre, monto]) => ({ nombre, monto: round2(monto) })).sort((a, b) => b.monto - a.monto).slice(0, n);
    };

    // ---- Semanal (solo lunes) ----
    if (esLunes) {
      const hace7 = sumarDiasISO(hoy, -6);
      const gastosSem = filas.filter((t) => t.type === "gasto" && (t.txn_date as string) >= hace7);
      const gasto7 = round2(gastosSem.reduce((s, t) => s + txBob(t), 0));
      const valHoy = valorEn(hoy);
      const val7 = valorEn(sumarDiasISO(hoy, -7));
      const deltaSemBob = valHoy != null && val7 != null ? round2(valHoy - val7) : null;
      const deltaSemPct = deltaSemBob != null && val7 ? deltaSemBob / val7 : null;
      const dpfProximos: ResumenDpfProx[] = rDpf
        ? rDpf.dpfs
            .filter((d) => d.status === "activo" && d.end_date >= hoy && d.end_date <= sumarDiasISO(hoy, 7))
            .map((d) => ({ titulo: d.pizarra || d.id_dpf_externo || "DPF", fecha: d.end_date, monto: d.montoAlVencimiento, dias: d.diasRestantes }))
        : [];
      let presuPct: number | null = null;
      let presuExc = 0;
      try {
        const rp = await getResumenPresupuestos(admin, period);
        presuPct = rp.pctGlobal;
        presuExc = rp.categoriasExcedidas;
      } catch { /* budgets/migración no lista */ }

      const sem = htmlResumenSemanal({
        fecha: hoy,
        gasto7,
        topCategorias: top(gastosSem, 5),
        deltaPatrimonioBob: deltaSemBob,
        deltaPatrimonioPct: deltaSemPct,
        dpfProximos,
        presupuestoPct: presuPct,
        presupuestoExcedidas: presuExc,
      });
      await enviarCorreo({ subject: sem.subject, html: sem.html, text: sem.text });
      semanalEnviado = true;
    }

    // ---- Mensual (día 1) → mes que acaba de cerrar ----
    if (esPrimerDiaDelMes) {
      const rep = prevPeriod;
      const inRep = (d: string) => d.slice(0, 7) === rep;
      const delMes = filas.filter((t) => inRep(t.txn_date as string));
      const gastosMes = delMes.filter((t) => t.type === "gasto");
      const ingresosMes = delMes.filter((t) => t.type === "ingreso");
      const valFin = valorEn(ultimoDiaDelMes(rep));
      const valIni = valorEn(sumarDiasISO(`${rep}-01`, -1));

      const deltaMesBob = valFin != null && valIni != null ? round2(valFin - valIni) : null;
      const deltaMesPct = deltaMesBob != null && valIni ? deltaMesBob / valIni : null;
      let presuPlan = 0;
      let presuGas = 0;
      let presuExcM = 0;
      try {
        const rpm = await getResumenPresupuestos(admin, rep);
        presuPlan = rpm.totalPlaneado;
        presuGas = rpm.totalGastado;
        presuExcM = rpm.categoriasExcedidas;
      } catch { /* sin budgets */ }
      let dpfCob = 0;
      let gananciaDpf = 0;
      if (rDpf) {
        const cob = rDpf.dpfs.filter((d) => d.status === "pagado" && d.paid_at && inRep(d.paid_at));
        dpfCob = cob.length;
        gananciaDpf = round2(cob.reduce((s, d) => s + (d.gcia_financiera ?? d.interesLiquido), 0));
      }
      const men = htmlReporteMensual({
        period: rep,
        movimientos: delMes.length,
        patrimonioFin: valFin,
        gastoMes: round2(gastosMes.reduce((s, t) => s + txBob(t), 0)),
        ingresoMes: round2(ingresosMes.reduce((s, t) => s + txBob(t), 0)),
        topCategorias: top(gastosMes, 6),
        deltaPatrimonioBob: deltaMesBob,
        deltaPatrimonioPct: deltaMesPct,
        presupuestoPlaneado: presuPlan,
        presupuestoGastado: presuGas,
        presupuestoExcedidas: presuExcM,
        dpfCobrados: dpfCob,
        gananciaDpfMes: gananciaDpf,
      });
      await enviarCorreo({ subject: men.subject, html: men.html, text: men.text });
      mensualEnviado = true;
    }
  }

  return {
    ok: true,
    alerta_presupuesto: alertaPresupuesto,
    alerta_deudas: alertaDeudas,
    patrimonio_enviado: true,
    alerta_enviada: alertaEnviada,
    dpf_vencen_hoy: vencenHoy.length,
    semanal_enviado: semanalEnviado,
    mensual_enviado: mensualEnviado,
  };
}

interface ResumenDpfProx {
  titulo: string;
  fecha: string;
  monto: number;
  dias: number;
}

function saldoCuenta(
  balances: BalRow[],
  match: (a: BalRow["account"]) => boolean,
  bob: (b: BalRow) => number
): number | null {
  const b = balances.find((x) => match(x.account));
  return b ? round2(bob(b)) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
