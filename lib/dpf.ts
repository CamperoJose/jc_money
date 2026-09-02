// Lógica pura de DPF (Depósitos a Plazo Fijo) y del simulador de laddering.
// Sin dependencias de red ni de Supabase: fácil de testear y de reutilizar en
// servidor y cliente. Todo el dinero está en BOB.

import type { DpfDeposit, DpfDepositUI, DpfLiberacion } from "@/lib/types";
import { fechaBoliviaHoy } from "@/lib/datetime";

/**
 * Base de días del año para el interés. El Excel del usuario calculaba el
 * "interés diario" como capital · tasa / 365, así que se conserva esa base para
 * que los números coincidan con lo que venía usando.
 */
export const DIAS_ANIO = 365;

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

/** Interés bruto proyectado a fin de plazo: capital · tasa · plazo / 365. */
export function interesBruto(principal: number, annualRate: number, termDays: number): number {
  return redondea((principal * annualRate * termDays) / DIAS_ANIO);
}

/** Interés líquido = bruto · (1 − RC-IVA). */
export function interesLiquido(bruto: number): number {
  return redondea(bruto * (1 - RC_IVA));
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
export function enriquecerDpf(d: DpfDeposit, hoy: string = fechaBoliviaHoy()): DpfDepositUI {
  const bruto = interesBruto(d.principal, d.annual_rate, d.term_days);
  const liquido = interesLiquido(bruto);
  const rcIva = redondea(bruto - liquido);
  const interesDiario = redondea((d.principal * d.annual_rate) / DIAS_ANIO);

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
    interesDiario,
    interesBruto: bruto,
    interesLiquido: liquido,
    rcIva,
    montoAlVencimiento: redondea(d.principal + liquido),
    diasRestantes,
    diasTotales,
    diasTranscurridos,
    progreso,
    liberacion,
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
  gananciaRealizadaLiquida: number; // Σ de los pagados (realizada o proyectada)
  capitalPagado: number; // Σ principal de los pagados
  proximo: DpfDepositUI | null; // próximo a vencer (no pagado, con fecha futura o vencido)
  proximasLiberaciones: DpfDepositUI[]; // no pagados ordenados por vencimiento
}

/** Construye el panel de indicadores a partir de los DPF crudos. */
export function resumenDpf(deposits: DpfDeposit[], hoy: string = fechaBoliviaHoy()): ResumenDpf {
  const dpfs = deposits
    .map((d) => enriquecerDpf(d, hoy))
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
  const capitalPagado = redondea(pagados.reduce((s, d) => s + d.principal, 0));

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
    capitalPagado,
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
  cadenciaDias: number; // cada cuántos días se abre un DPF
  plazoDias: number; // plazo de cada DPF
  tasaAnual: number; // ej. 0.077
  periodos: number; // cuántos DPF se abren
  reinvertirInteres: boolean; // reinvertir el interés líquido al vencer
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
    const fecha = sumarDias(p.fechaInicio, i * p.cadenciaDias);

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

    const bruto = interesBruto(principal, p.tasaAnual, p.plazoDias);
    const liquido = interesLiquido(bruto);
    const vencimiento = sumarDias(fecha, p.plazoDias);

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
