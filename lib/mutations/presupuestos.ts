import type { SupabaseClient } from "@supabase/supabase-js";

export interface BudgetInput {
  period: string; // 'YYYY-MM'
  category_id: string;
  amount_planned: number;
}

export function validarBudget(input: BudgetInput): string | null {
  if (!/^\d{4}-\d{2}$/.test(input.period)) return "Periodo inválido (YYYY-MM).";
  if (!input.category_id) return "Falta la categoría.";
  if (!Number.isFinite(input.amount_planned) || input.amount_planned < 0) {
    return "El monto no puede ser negativo.";
  }
  return null;
}

/**
 * Upsert de presupuesto por (period, category_id). Si el monto es 0, borra el
 * presupuesto (quitar tope). Devuelve el id o null si se borró.
 */
export async function guardarBudget(
  supabase: SupabaseClient,
  input: BudgetInput
): Promise<string | null> {
  const amount = Math.round(input.amount_planned * 100) / 100;
  if (amount <= 0) {
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("period", input.period)
      .eq("category_id", input.category_id);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { period: input.period, category_id: input.category_id, amount_planned: amount },
      { onConflict: "period,category_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Copia los presupuestos de `desde` (YYYY-MM) a `hacia`, sin pisar existentes. */
export async function copiarPresupuestos(
  supabase: SupabaseClient,
  desde: string,
  hacia: string
): Promise<number> {
  const { data, error } = await supabase
    .from("budgets")
    .select("category_id, amount_planned")
    .eq("period", desde);
  if (error) throw error;
  const filas = (data ?? []).map((r) => ({
    period: hacia,
    category_id: r.category_id as string,
    amount_planned: Number(r.amount_planned),
  }));
  if (!filas.length) return 0;
  const { error: eUp } = await supabase.from("budgets").upsert(filas, { onConflict: "period,category_id" });
  if (eUp) throw eUp;
  return filas.length;
}
