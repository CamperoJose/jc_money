import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetStatus, Currency } from "@/lib/types";

export interface AssetInput {
  name: string;
  category?: string | null;
  acquired_date?: string | null;
  acquisition_cost: number;
  currency?: Currency;
  current_value?: number | null;
  sellable?: boolean;
  counts_in_patrimonio?: boolean;
  status?: AssetStatus;
  sold_date?: string | null;
  sold_price?: number | null;
  notes?: string | null;
}

export function validarActivo(input: AssetInput): string | null {
  if (!input.name || !input.name.trim()) return "El nombre es obligatorio.";
  if (!Number.isFinite(input.acquisition_cost) || input.acquisition_cost < 0) {
    return "El costo de adquisición no puede ser negativo.";
  }
  if (input.currency && !["BOB", "USD", "USDT"].includes(input.currency)) return "Moneda inválida.";
  if (input.status && !["activo", "vendido"].includes(input.status)) return "Estado inválido.";
  if (input.status === "vendido") {
    if (input.sold_price == null || !(input.sold_price >= 0)) {
      return "Al vender, ingresa el precio de venta.";
    }
    if (!input.sold_date) return "Al vender, ingresa la fecha de venta.";
  }
  return null;
}

function limpiar(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}
function money(n?: number | null): number | null {
  return n == null ? null : Math.round(n * 100) / 100;
}

function filaDesde(input: AssetInput) {
  const status = input.status ?? "activo";
  const vendido = status === "vendido";
  return {
    name: input.name.trim(),
    category: limpiar(input.category),
    acquired_date: input.acquired_date || null,
    acquisition_cost: money(input.acquisition_cost) ?? 0,
    currency: input.currency ?? "BOB",
    current_value: money(input.current_value),
    sellable: input.sellable ?? true,
    counts_in_patrimonio: input.counts_in_patrimonio ?? true,
    status,
    // Datos de venta solo si está vendido.
    sold_date: vendido ? input.sold_date || null : null,
    sold_price: vendido ? money(input.sold_price) : null,
    notes: limpiar(input.notes),
  };
}

export async function crearActivo(supabase: SupabaseClient, input: AssetInput): Promise<string> {
  const { data, error } = await supabase.from("assets").insert(filaDesde(input)).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarActivo(
  supabase: SupabaseClient,
  id: string,
  input: AssetInput
): Promise<void> {
  const { error } = await supabase.from("assets").update(filaDesde(input)).eq("id", id);
  if (error) throw error;
}

export async function borrarActivo(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
}
