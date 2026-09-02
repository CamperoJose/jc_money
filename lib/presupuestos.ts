// Lógica pura de presupuestos: cruza el plan por categoría con lo gastado.
import type { Budget, BudgetUI, BudgetEstado, Category } from "@/lib/types";

const UMBRAL_ALERTA = 0.85; // ≥85% del presupuesto → alerta

function redondea(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ResumenPresupuestos {
  period: string;
  filas: BudgetUI[];
  totalPlaneado: number;
  totalGastado: number;
  totalRestante: number;
  pctGlobal: number | null;
  categoriasExcedidas: number;
  categoriasEnAlerta: number;
  conPresupuesto: number;
}

function estadoDe(planned: number, spent: number): BudgetEstado {
  if (planned <= 0) return "sin_presupuesto";
  const r = spent / planned;
  if (r > 1) return "excedido";
  if (r >= UMBRAL_ALERTA) return "alerta";
  return "ok";
}

/**
 * Arma el resumen del presupuesto del periodo: para cada categoría de gasto,
 * el plan (si existe) y lo gastado (mapa category_id → BOB).
 */
export function resumenPresupuestos(
  period: string,
  budgets: Budget[],
  categorias: Category[],
  gastadoPorCategoria: Map<string, number>
): ResumenPresupuestos {
  const planPorCat = new Map(budgets.map((b) => [b.category_id, b]));
  const cats = categorias.filter((c) => c.kind === "gasto" && c.active);

  const filas: BudgetUI[] = cats.map((c) => {
    const b = planPorCat.get(c.id);
    const planned = b ? Number(b.amount_planned) : 0;
    const spent = redondea(gastadoPorCategoria.get(c.id) ?? 0);
    return {
      category_id: c.id,
      category_name: c.name,
      planned: redondea(planned),
      spent,
      restante: redondea(planned - spent),
      pct: planned > 0 ? spent / planned : 0,
      estado: estadoDe(planned, spent),
      budget_id: b?.id ?? null,
    };
  });

  // Orden: primero las que tienen presupuesto (mayor % primero), luego el resto.
  filas.sort((a, b) => {
    const ap = a.planned > 0 ? 1 : 0;
    const bp = b.planned > 0 ? 1 : 0;
    if (ap !== bp) return bp - ap;
    if (ap === 1) return b.pct - a.pct;
    return b.spent - a.spent;
  });

  const conPlan = filas.filter((f) => f.planned > 0);
  const totalPlaneado = redondea(conPlan.reduce((s, f) => s + f.planned, 0));
  const totalGastado = redondea(conPlan.reduce((s, f) => s + f.spent, 0));

  return {
    period,
    filas,
    totalPlaneado,
    totalGastado,
    totalRestante: redondea(totalPlaneado - totalGastado),
    pctGlobal: totalPlaneado > 0 ? totalGastado / totalPlaneado : null,
    categoriasExcedidas: conPlan.filter((f) => f.estado === "excedido").length,
    categoriasEnAlerta: conPlan.filter((f) => f.estado === "alerta").length,
    conPresupuesto: conPlan.length,
  };
}
