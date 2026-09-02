// Lógica pura de Deudas (que me deben). Todo en BOB.
import type { Debt, DebtUI } from "@/lib/types";
import { fechaBoliviaHoy } from "@/lib/datetime";

function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}

function diasEntre(a: string, b: string): number {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return 0;
  return Math.round((mb - ma) / 86_400_000);
}

export function enriquecerDeuda(d: Debt, hoy: string = fechaBoliviaHoy()): DebtUI {
  const outstanding = redondea(Math.max(0, d.amount - d.paid_amount));
  const pendiente = d.status !== "pagado" && outstanding > 0;
  const vencida = pendiente && !!d.due_date && d.due_date < hoy;
  const diasVencida = vencida && d.due_date ? diasEntre(d.due_date, hoy) : null;
  return { ...d, outstanding, vencida, diasVencida };
}

export interface ResumenDeudas {
  deudas: DebtUI[];
  totalPorCobrar: number; // Σ outstanding de las no pagadas
  totalPrestado: number; // Σ amount histórico
  totalCobrado: number; // Σ paid_amount
  cuentaPendientes: number; // nº con saldo por cobrar
  cuentaVencidas: number; // nº vencidas
  porCobrarVencido: number; // Σ outstanding de las vencidas
  porContraparte: { nombre: string; monto: number }[]; // por cobrar por deudor
}

export function resumenDeudas(debts: Debt[], hoy: string = fechaBoliviaHoy()): ResumenDeudas {
  const deudas = debts
    .map((d) => enriquecerDeuda(d, hoy))
    .sort((a, b) => (b.outstanding - a.outstanding) || (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const pendientes = deudas.filter((d) => d.outstanding > 0 && d.status !== "pagado");
  const totalPorCobrar = redondea(pendientes.reduce((s, d) => s + d.outstanding, 0));
  const totalPrestado = redondea(deudas.reduce((s, d) => s + d.amount, 0));
  const totalCobrado = redondea(deudas.reduce((s, d) => s + d.paid_amount, 0));
  const vencidas = pendientes.filter((d) => d.vencida);
  const porCobrarVencido = redondea(vencidas.reduce((s, d) => s + d.outstanding, 0));

  const mapa = new Map<string, number>();
  for (const d of pendientes) {
    const nombre = d.counterparty || "Sin nombre";
    mapa.set(nombre, (mapa.get(nombre) ?? 0) + d.outstanding);
  }
  const porContraparte = [...mapa.entries()]
    .map(([nombre, monto]) => ({ nombre, monto: redondea(monto) }))
    .sort((a, b) => b.monto - a.monto);

  return {
    deudas,
    totalPorCobrar,
    totalPrestado,
    totalCobrado,
    cuentaPendientes: pendientes.length,
    cuentaVencidas: vencidas.length,
    porCobrarVencido,
    porContraparte,
  };
}
