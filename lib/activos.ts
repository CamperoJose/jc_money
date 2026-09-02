// Lógica pura de Activos (bienes vendibles). Los montos están en la moneda del
// activo; la conversión a BOB se hace en el job/lecturas con el T/C.
import type { Asset, AssetUI } from "@/lib/types";
import { fechaBoliviaHoy } from "@/lib/datetime";

function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}
function redondea4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function diasEntre(a: string, b: string): number {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return 0;
  return Math.round((mb - ma) / 86_400_000);
}

export function enriquecerActivo(a: Asset, hoy: string = fechaBoliviaHoy()): AssetUI {
  const realizado = a.status === "vendido";
  const valorActual = redondea(a.current_value ?? a.acquisition_cost);
  const resultado = redondea(
    realizado ? (a.sold_price ?? 0) - a.acquisition_cost : valorActual - a.acquisition_cost
  );
  const resultadoPct = a.acquisition_cost > 0 ? redondea4(resultado / a.acquisition_cost) : null;
  const fin = realizado ? a.sold_date : hoy;
  const diasTenencia = a.acquired_date && fin ? Math.max(0, diasEntre(a.acquired_date, fin)) : null;
  return { ...a, valorActual, resultado, resultadoPct, realizado, diasTenencia };
}

export interface ResumenActivos {
  activos: AssetUI[];
  valorEnPatrimonio: number; // Σ valorActual de activos que cuentan (no vendidos)
  valorTotalActivos: number; // Σ valorActual de todos los no vendidos
  costoTotal: number; // Σ costo de los no vendidos
  plusvaliaNoRealizada: number; // Σ resultado de los no vendidos (contables)
  gananciaRealizada: number; // Σ resultado de los vendidos
  cuentaActivos: number; // nº no vendidos
  cuentaVendidos: number; // nº vendidos
  rendimientoRealizado: number | null; // Σ resultado vendidos / Σ costo vendidos
}

export function resumenActivos(assets: Asset[], hoy: string = fechaBoliviaHoy()): ResumenActivos {
  const activos = assets
    .map((a) => enriquecerActivo(a, hoy))
    .sort((a, b) => Number(a.realizado) - Number(b.realizado) || b.valorActual - a.valorActual);

  const vigentes = activos.filter((a) => !a.realizado);
  const vendidos = activos.filter((a) => a.realizado);
  const contables = vigentes.filter((a) => a.counts_in_patrimonio);

  const costoVendidos = redondea(vendidos.reduce((s, a) => s + a.acquisition_cost, 0));
  const resultadoVendidos = redondea(vendidos.reduce((s, a) => s + a.resultado, 0));

  return {
    activos,
    valorEnPatrimonio: redondea(contables.reduce((s, a) => s + a.valorActual, 0)),
    valorTotalActivos: redondea(vigentes.reduce((s, a) => s + a.valorActual, 0)),
    costoTotal: redondea(vigentes.reduce((s, a) => s + a.acquisition_cost, 0)),
    plusvaliaNoRealizada: redondea(contables.reduce((s, a) => s + a.resultado, 0)),
    gananciaRealizada: resultadoVendidos,
    cuentaActivos: vigentes.length,
    cuentaVendidos: vendidos.length,
    rendimientoRealizado: costoVendidos > 0 ? redondea4(resultadoVendidos / costoVendidos) : null,
  };
}
