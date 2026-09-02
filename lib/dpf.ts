// Lógica pura de DPF (Depósitos a Plazo Fijo) y del simulador de laddering.
// Sin dependencias de red ni de Supabase: fácil de testear y de reutilizar en
// servidor y cliente. Todo el dinero está en BOB.

import type { Account, DpfDeposit, DpfDepositUI, DpfLiberacion } from "@/lib/types";
import { fechaBoliviaHoy } from "@/lib/datetime";

/** Meses del año (base del cálculo de interés). */
export const MESES_ANIO = 12;

/** Retención RC-IVA en Bolivia sobre rendimientos financieros (13%). */
export const RC_IVA = 0.13;

/** Umbral (días) para marcar un DPF como "por liberar" (vencimiento cercano). */
export const UMBRAL_PROXIMO_DIAS = 7;

/** Diferencia en días entre dos fechas "YYYY-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return 0;
  return Math.round((mb - ma) / 86_400_000);
}

/** Suma `dias` a una fecha "YYYY-MM-DD" y devuelve "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Suma `meses` a una fecha "YYYY-MM-DD" (clampeando el día al fin de mes cuando
 * corresponde, ej. 31 ene + 1 mes = 28/29 feb). Devuelve "YYYY-MM-DD".
 */
export function sumarMeses(fecha: string, meses: number): string {
  const [y, m, dd] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const dia = Math.min(dd, ultimoDia);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia)).toISOString().slice(0, 10);
}

/**
 * Interés bruto proyectado a fin de plazo. El interés es anual y se prorratea
 * por los MESES invertidos: capital · tasa · (meses / 12).
 */
export function interesBruto(principal: number, annualRate: number, termMonths: number): number {
  return redondea((principal * annualRate * termMonths) / MESES_ANIO);
}

/**
 * Interés líquido. Solo se retiene RC-IVA (13%) si el DPF cobra IVA; en caso
 * contrario el líquido es igual al bruto (sin retención).
 */
export function interesLiquido(bruto: number, cobraIva = false): number {
  return redondea(cobraIva ? bruto * (1 - RC_IVA) : bruto);
}

/** Redondea un porcentaje/tasa a 4 decimales, matando el ruido de float. */
export function redondeaTasa(fraccion: number): number {
  return Math.round(fraccion * 10000) / 10000;
}

/** Redondea a 2 decimales (dinero). */
export function redondeaMonto(n: number): number {
  return redondea(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Enriquece un DPF con todos sus derivados (interés, días restantes, progreso,
 * estado de liberación). `hoy` por defecto = hoy en Bolivia.
 */
export function enriquecerDpf(
  d: DpfDeposit,
  hoy: string = fechaBoliviaHoy(),
  cuentas?: Map<string, Account>
): DpfDepositUI {
  const bruto = interesBruto(d.principal, d.annual_rate, d.term_months);
  const liquido = interesLiquido(bruto, d.cobra_iva);
  const rcIva = redondea(bruto - liquido);
  const interesMensual = redondea((d.principal * d.annual_rate) / MESES_ANIO);

  const diasTotales = Math.max(1, diasEntre(d.start_date, d.end_date));
  const diasRestantes = diasEntre(hoy, d.end_date);
  const diasTranscurridos = clamp(diasEntre(d.start_date, hoy), 0, diasTotales);
  const progreso = clamp(diasTranscurridos / diasTotales, 0, 1);

  let liberacion: DpfLiberacion;
  if (d.status === "pagado") liberacion = "pagado";
  else if (diasRestantes < 0) liberacion = "vencido";
  else if (diasRestantes <= UMBRAL_PROXIMO_DIAS) liberacion = "por_liberar";
  else liberacion = "activo";

  return {
    ...d,
    interesMensual,
    interesBruto: bruto,
    interesLiquido: liquido,
    rcIva,
    montoAlVencimiento: redondea(d.principal + liquido),
    diasRestantes,
    diasTotales,
    diasTranscurridos,
    progreso,
    liberacion,
    paidAccount: d.paid_account_id ? cuentas?.get(d.paid_account_id) ?? null : null,
  };
}

// ============================================================================
// Panel de indicadores (agregación de la cartera)
// ============================================================================

export interface ResumenDpf {
  dpfs: DpfDepositUI[];
  montoEnDpf: number; // Σ principal de los no pagados (capital vigente)
  gananciaBruta: number; // Σ interés bruto proyectado (no pagados)
  gananciaLiquida: number; // Σ interés líquido proyectado (no pagados)
  rcIva: number; // Σ retención (no pagados)
  tasaPromedio: number | null; // ponderada por capital (no pagados)
  dpfsActivos: number; // count no pagados
  dpfsVencidos: number; // count vencidos sin cobrar (requieren acción)
  totalHistorico: number; // count total
  rendimientoNeto: number | null; // gananciaLiquida / montoEnDpf
  gananciaRealizadaLiquida: number; // Σ líquida de los pagados (realizada)
  gananciaRealizadaBruta: number; // Σ bruta de los pagados
  capitalPagado: number; // Σ principal de los pagados
  dpfsCobrados: number; // count pagados
  capitalRotado: number; // Σ principal de TODOS (dinero que ha pasado por DPF)
  gananciaTotal: number; // realizada (líquida) + proyectada (líquida, activos)
  interesMensualActivo: number; // Σ interés mensual de los activos (flujo/mes)
  rendimientoRealizado: number | null; // gananciaRealizadaLiquida / capitalPagado
  diasInvertido: number | null; // hoy − primera fecha de inicio
  primerInicio: string | null; // fecha del primer DPF
  tasaMax: number | null; // mayor tasa entre activos
  tasaMin: number | null; // menor tasa entre activos
  porEntidad: { nombre: string; capital: number; dpfs: number }[]; // activos por entidad
  serieRotacion: { periodo: string; abierto: number; acumulado: number }[]; // capital abierto por mes
  proximo: DpfDepositUI | null; // próximo a vencer (no pagado, con fecha futura o vencido)
  proximasLiberaciones: DpfDepositUI[]; // no pagados ordenados por vencimiento
}

/** Construye el panel de indicadores a partir de los DPF crudos. */
export function resumenDpf(
  deposits: DpfDeposit[],
  hoy: string = fechaBoliviaHoy(),
  cuentas?: Map<string, Account>
): ResumenDpf {
  const dpfs = deposits
    .map((d) => enriquecerDpf(d, hoy, cuentas))
    .sort((a, b) => a.end_date.localeCompare(b.end_date));

  const noPagados = dpfs.filter((d) => d.status !== "pagado");
  const pagados = dpfs.filter((d) => d.status === "pagado");

  const montoEnDpf = redondea(noPagados.reduce((s, d) => s + d.principal, 0));
  const gananciaBruta = redondea(noPagados.reduce((s, d) => s + d.interesBruto, 0));
  const gananciaLiquida = redondea(noPagados.reduce((s, d) => s + d.interesLiquido, 0));
  const rcIva = redondea(gananciaBruta - gananciaLiquida);

  const sumaPonderada = noPagados.reduce((s, d) => s + d.principal * d.annual_rate, 0);
  const tasaPromedio = montoEnDpf > 0 ? redondea4(sumaPonderada / montoEnDpf) : null;

  const gananciaRealizadaLiquida = redondea(
    pagados.reduce((s, d) => s + (d.gcia_financiera ?? d.interesLiquido), 0)
  );
  const gananciaRealizadaBruta = redondea(
    pagados.reduce((s, d) => s + (d.gcia_economica ?? d.interesBruto), 0)
  );
  const capitalPagado = redondea(pagados.reduce((s, d) => s + d.principal, 0));
  const capitalRotado = redondea(dpfs.reduce((s, d) => s + d.principal, 0));
  const gananciaTotal = redondea(gananciaRealizadaLiquida + gananciaLiquida);
  const interesMensualActivo = redondea(noPagados.reduce((s, d) => s + d.interesMensual, 0));
  const rendimientoRealizado = capitalPagado > 0 ? redondea4(gananciaRealizadaLiquida / capitalPagado) : null;

  const tasasActivas = noPagados.map((d) => d.annual_rate);
  const tasaMax = tasasActivas.length ? Math.max(...tasasActivas) : null;
  const tasaMin = tasasActivas.length ? Math.min(...tasasActivas) : null;

  const inicios = dpfs.map((d) => d.start_date).filter(Boolean).sort();
  const primerInicio = inicios[0] ?? null;
  const diasInvertido = primerInicio ? Math.max(0, diasEntre(primerInicio, hoy)) : null;

  // Capital activo por entidad (pizarra).
  const entidadMap = new Map<string, { capital: number; dpfs: number }>();
  for (const d of noPagados) {
    const nombre = d.pizarra || "Sin entidad";
    const cur = entidadMap.get(nombre) ?? { capital: 0, dpfs: 0 };
    cur.capital += d.principal;
    cur.dpfs += 1;
    entidadMap.set(nombre, cur);
  }
  const porEntidad = [...entidadMap.entries()]
    .map(([nombre, v]) => ({ nombre, capital: redondea(v.capital), dpfs: v.dpfs }))
    .sort((a, b) => b.capital - a.capital);

  // Serie de rotación: capital abierto por mes (por fecha de inicio) + acumulado.
  const rotMap = new Map<string, number>();
  for (const d of dpfs) {
    const periodo = d.start_date.slice(0, 7);
    rotMap.set(periodo, (rotMap.get(periodo) ?? 0) + d.principal);
  }
  let acumulado = 0;
  const serieRotacion = [...rotMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodo, abierto]) => {
      acumulado = redondea(acumulado + abierto);
      return { periodo, abierto: redondea(abierto), acumulado };
    });

  // Próximas liberaciones: no pagados ordenados por fecha de vencimiento.
  const proximasLiberaciones = [...noPagados].sort((a, b) => a.end_date.localeCompare(b.end_date));
  const proximo = proximasLiberaciones[0] ?? null;

  return {
    dpfs,
    montoEnDpf,
    gananciaBruta,
    gananciaLiquida,
    rcIva,
    tasaPromedio,
    dpfsActivos: noPagados.length,
    dpfsVencidos: noPagados.filter((d) => d.liberacion === "vencido").length,
    totalHistorico: dpfs.length,
    rendimientoNeto: montoEnDpf > 0 ? redondea4(gananciaLiquida / montoEnDpf) : null,
    gananciaRealizadaLiquida,
    gananciaRealizadaBruta,
    capitalPagado,
    dpfsCobrados: pagados.length,
    capitalRotado,
    gananciaTotal,
    interesMensualActivo,
    rendimientoRealizado,
    diasInvertido,
    primerInicio,
    tasaMax,
    tasaMin,
    porEntidad,
    serieRotacion,
    proximo,
    proximasLiberaciones,
  };
}

function redondea4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================================
// Simulador de laddering
// ============================================================================

export interface ParamsSimulador {
  montoInicial: number; // capital de arranque (Bs)
  aportePeriodico: number; // aporte fresco por periodo (Bs)
  cadenciaMeses: number; // cada cuántos meses se abre un DPF
  plazoMeses: number; // plazo de cada DPF (meses)
  tasaAnual: number; // ej. 0.077
  periodos: number; // cuántos DPF se abren
  reinvertirInteres: boolean; // reinvertir el interés líquido al vencer
  cobraIva: boolean; // aplicar retención RC-IVA (13%) al interés
  fechaInicio: string; // YYYY-MM-DD
}

export interface FilaSimulador {
  periodo: number; // 1..N
  fecha: string; // apertura del DPF de este periodo
  vencimiento: string;
  aporteFresco: number; // dinero nuevo aportado este periodo
  liberadoCapital: number; // capital que venció y se reinvierte
  liberadoInteres: number; // interés líquido liberado este periodo
  principal: number; // monto del nuevo DPF
  interesLiquido: number; // interés líquido que rendirá al vencer
  capitalActivo: number; // Σ principal de DPF vigentes tras este periodo
  aportadoAcumulado: number; // Σ dinero fresco hasta este periodo
  interesAcumulado: number; // Σ interés líquido generado hasta este periodo
}

export interface ResultadoSimulador {
  filas: FilaSimulador[];
  aportadoTotal: number; // dinero fresco total (montoInicial + aportes)
  interesBrutoTotal: number;
  interesLiquidoTotal: number;
  rcIvaTotal: number;
  capitalFinalActivo: number; // capital aún invertido al final
  valorFinal: number; // capital activo + interés líquido no reinvertido
  tasaEfectiva: number | null; // interés líquido total / aportado total
  duracionDias: number; // del primer aporte al último vencimiento
}

interface DepSim {
  apertura: string;
  vencimiento: string;
  principal: number;
  interesLiquido: number;
  interesBruto: number;
  liberado: boolean;
}

/**
 * Simula una escalera (laddering) de DPF: cada `cadenciaDias` se abre un DPF
 * cuyo monto = aporte fresco + capital (e interés, si se reinvierte) que se
 * liberó desde el periodo anterior. Devuelve la línea de tiempo y los totales.
 */
export function simularLaddering(p: ParamsSimulador): ResultadoSimulador {
  const periodos = Math.max(1, Math.min(600, Math.floor(p.periodos)));
  const deposits: DepSim[] = [];
  const filas: FilaSimulador[] = [];

  let aportadoAcumulado = 0;
  let interesAcumulado = 0;
  let fechaPrev = "";

  for (let i = 0; i < periodos; i++) {
    const fecha = sumarMeses(p.fechaInicio, i * p.cadenciaMeses);

    // Libera los DPF que vencieron en (fechaPrev, fecha].
    let liberadoCapital = 0;
    let liberadoInteres = 0;
    for (const d of deposits) {
      if (!d.liberado && d.vencimiento <= fecha) {
        d.liberado = true;
        liberadoCapital += d.principal;
        liberadoInteres += d.interesLiquido;
      }
    }
    liberadoCapital = redondea(liberadoCapital);
    liberadoInteres = redondea(liberadoInteres);

    const aporteFresco = redondea(p.aportePeriodico + (i === 0 ? p.montoInicial : 0));
    const reinversion = liberadoCapital + (p.reinvertirInteres ? liberadoInteres : 0);
    const principal = redondea(aporteFresco + reinversion);

    const bruto = interesBruto(principal, p.tasaAnual, p.plazoMeses);
    const liquido = interesLiquido(bruto, p.cobraIva);
    const vencimiento = sumarMeses(fecha, p.plazoMeses);

    deposits.push({ apertura: fecha, vencimiento, principal, interesLiquido: liquido, interesBruto: bruto, liberado: false });

    aportadoAcumulado = redondea(aportadoAcumulado + aporteFresco);
    interesAcumulado = redondea(interesAcumulado + liquido);
    const capitalActivo = redondea(deposits.filter((d) => !d.liberado).reduce((s, d) => s + d.principal, 0));

    filas.push({
      periodo: i + 1,
      fecha,
      vencimiento,
      aporteFresco,
      liberadoCapital,
      liberadoInteres,
      principal,
      interesLiquido: liquido,
      capitalActivo,
      aportadoAcumulado,
      interesAcumulado,
    });
    fechaPrev = fecha;
  }
  void fechaPrev;

  const interesBrutoTotal = redondea(deposits.reduce((s, d) => s + d.interesBruto, 0));
  const interesLiquidoTotal = redondea(deposits.reduce((s, d) => s + d.interesLiquido, 0));
  const aportadoTotal = redondea(p.montoInicial + p.aportePeriodico * periodos);
  const capitalFinalActivo = redondea(deposits.filter((d) => !d.liberado).reduce((s, d) => s + d.principal, 0));
  // Interés líquido de los DPF aún vigentes (se cobrará al vencer).
  const interesPendiente = redondea(deposits.filter((d) => !d.liberado).reduce((s, d) => s + d.interesLiquido, 0));

  const ultimoVenc = deposits.reduce((max, d) => (d.vencimiento > max ? d.vencimiento : max), p.fechaInicio);

  return {
    filas,
    aportadoTotal,
    interesBrutoTotal,
    interesLiquidoTotal,
    rcIvaTotal: redondea(interesBrutoTotal - interesLiquidoTotal),
    capitalFinalActivo,
    valorFinal: redondea(capitalFinalActivo + interesPendiente),
    tasaEfectiva: aportadoTotal > 0 ? redondea4(interesLiquidoTotal / aportadoTotal) : null,
    duracionDias: diasEntre(p.fechaInicio, ultimoVenc),
  };
}
