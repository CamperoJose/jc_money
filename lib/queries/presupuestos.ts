import type { SupabaseClient } from "@supabase/supabase-js";
import type { Budget, Currency } from "@/lib/types";
import { getCategorias } from "@/lib/queries/gastos";
import { resumenPresupuestos, type ResumenPresupuestos } from "@/lib/presupuestos";

/** Periodo actual 'YYYY-MM' en zona Bolivia. */
export function periodoActual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

function montoBob(amount: number, currency: Currency, rate: number | null): number {
  if (currency === "BOB") return amount;
  const r = rate && rate > 0 ? rate : 1;
  return amount * r;
}

export async function getBudgets(supabase: SupabaseClient, period: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, period, category_id, amount_planned")
    .eq("period", period);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    period: r.period as string,
    category_id: r.category_id as string,
    amount_planned: Number(r.amount_planned),
  }));
}

/** Gasto por categoría (BOB) del periodo 'YYYY-MM'. */
export async function getGastadoPorCategoria(
  supabase: SupabaseClient,
  period: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, currency, exchange_rate, category_id, txn_date, type")
    .eq("type", "gasto")
    .gte("txn_date", `${period}-01`)
    .lte("txn_date", `${period}-31`);
  if (error) throw error;
  const mapa = new Map<string, number>();
  for (const t of data ?? []) {
    const cid = t.category_id as string | null;
    if (!cid) continue;
    const bob = montoBob(Number(t.amount), t.currency as Currency, t.exchange_rate != null ? Number(t.exchange_rate) : null);
    mapa.set(cid, (mapa.get(cid) ?? 0) + bob);
  }
  return mapa;
}

export async function getResumenPresupuestos(
  supabase: SupabaseClient,
  period: string = periodoActual()
): Promise<ResumenPresupuestos> {
  const [budgets, categorias, gastado] = await Promise.all([
    getBudgets(supabase, period),
    getCategorias(supabase),
    getGastadoPorCategoria(supabase, period),
  ]);
  return resumenPresupuestos(period, budgets, categorias, gastado);
}
