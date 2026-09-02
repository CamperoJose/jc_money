import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset } from "@/lib/types";
import { resumenActivos, type ResumenActivos } from "@/lib/activos";

const CAMPOS =
  "id, name, category, acquired_date, acquisition_cost, currency, current_value, sellable, counts_in_patrimonio, status, sold_date, sold_price, sold_account_id, notes";

function aAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string,
    name: r.name as string,
    category: (r.category as string) ?? null,
    acquired_date: (r.acquired_date as string) ?? null,
    acquisition_cost: Number(r.acquisition_cost),
    currency: (r.currency as Asset["currency"]) ?? "BOB",
    current_value: r.current_value != null ? Number(r.current_value) : null,
    sellable: Boolean(r.sellable),
    counts_in_patrimonio: Boolean(r.counts_in_patrimonio),
    status: (r.status as Asset["status"]) ?? "activo",
    sold_date: (r.sold_date as string) ?? null,
    sold_price: r.sold_price != null ? Number(r.sold_price) : null,
    sold_account_id: (r.sold_account_id as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export async function getActivos(supabase: SupabaseClient): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select(CAMPOS)
    .order("status", { ascending: true })
    .order("acquired_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => aAsset(r as Record<string, unknown>));
}

export async function getResumenActivos(supabase: SupabaseClient): Promise<ResumenActivos> {
  const activos = await getActivos(supabase);
  return resumenActivos(activos);
}
