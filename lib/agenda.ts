// «Qué se viene»: compromisos y cobros de los próximos días, en una sola lista
// ordenada por fecha. Lógica pura.
//
// Junta cosas que hoy viven en pantallas distintas (DPF, deudas, recurrentes),
// que es justo el problema: para saber qué te espera esta quincena había que
// entrar a tres sitios.

import type { DpfDepositUI } from "@/lib/types";
import type { DebtUI } from "@/lib/types";
import type { GastoRecurrente } from "@/lib/analisis";

export type TipoEvento = "dpf" | "cobro" | "recurrente";

export interface EventoAgenda {
  id: string;
  tipo: TipoEvento;
  fecha: string; // YYYY-MM-DD
  dias: number; // días desde hoy (negativo = vencido)
  titulo: string;
  detalle: string | null;
  /** Positivo = entra dinero; negativo = sale. */
  monto: number;
  vencido: boolean;
  /** El recurrente es una estimación, no un compromiso real. */
  estimado: boolean;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface OpcionesAgenda {
  /** Ventana hacia adelante, en días. */
  horizonte?: number;
  /** Cuántos días hacia atrás se siguen mostrando los vencidos. */
  atras?: number;
}

export function construirAgenda(
  hoy: string,
  datos: {
    dpfs?: DpfDepositUI[] | null;
    deudas?: DebtUI[] | null;
    recurrentes?: GastoRecurrente[] | null;
  },
  opciones: OpcionesAgenda = {}
): EventoAgenda[] {
  const horizonte = opciones.horizonte ?? 45;
  const atras = opciones.atras ?? 60;
  const eventos: EventoAgenda[] = [];

  const dentroDeVentana = (fecha: string): number | null => {
    const d = diasEntre(hoy, fecha);
    return d <= horizonte && d >= -atras ? d : null;
  };

  for (const dpf of datos.dpfs ?? []) {
    if (dpf.status !== "activo" || !dpf.end_date) continue;
    const d = dentroDeVentana(dpf.end_date);
    if (d == null) continue;
    eventos.push({
      id: `dpf-${dpf.id}`,
      tipo: "dpf",
      fecha: dpf.end_date,
      dias: d,
      titulo: dpf.pizarra || dpf.id_dpf_externo || "DPF",
      detalle: "Vence tu depósito a plazo fijo",
      monto: dpf.montoAlVencimiento,
      vencido: d < 0,
      estimado: false,
    });
  }

  for (const deuda of datos.deudas ?? []) {
    if (deuda.outstanding <= 0 || deuda.status === "pagado" || !deuda.due_date) continue;
    const d = dentroDeVentana(deuda.due_date);
    if (d == null) continue;
    eventos.push({
      id: `deuda-${deuda.id}`,
      tipo: "cobro",
      fecha: deuda.due_date,
      dias: d,
      titulo: deuda.counterparty || "Sin nombre",
      detalle: deuda.reason ? `Te debe: ${deuda.reason}` : "Deuda por cobrar",
      monto: deuda.outstanding,
      vencido: d < 0,
      estimado: false,
    });
  }

  for (const r of datos.recurrentes ?? []) {
    // Un recurrente ya pasado no interesa: se recalcula solo con el próximo
    // registro. Solo se mira hacia adelante.
    const d = diasEntre(hoy, r.proximaEstimada);
    if (d < 0 || d > horizonte) continue;
    eventos.push({
      id: `rec-${r.descripcion}-${r.cadaDias}`,
      tipo: "recurrente",
      fecha: r.proximaEstimada,
      dias: d,
      titulo: r.descripcion,
      detalle: `Suele repetirse cada ${r.cadaDias} días`,
      monto: -r.montoTipico,
      vencido: false,
      estimado: true,
    });
  }

  // Lo vencido primero (es lo que exige actuar), después por cercanía.
  return eventos.sort((a, b) => {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    return a.fecha.localeCompare(b.fecha);
  });
}

export interface ResumenAgenda {
  entra: number;
  sale: number;
  vencidos: number;
}

export function resumirAgenda(eventos: EventoAgenda[]): ResumenAgenda {
  let entra = 0;
  let sale = 0;
  let vencidos = 0;
  for (const e of eventos) {
    if (e.monto >= 0) entra += e.monto;
    else sale += -e.monto;
    if (e.vencido) vencidos++;
  }
  return {
    entra: Math.round(entra * 100) / 100,
    sale: Math.round(sale * 100) / 100,
    vencidos,
  };
}
