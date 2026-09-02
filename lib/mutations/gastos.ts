import type { SupabaseClient } from "@supabase/supabase-js";
import { isoAFechaBolivia } from "@/lib/datetime";
import type { Currency, TxnType } from "@/lib/types";

export interface TransaccionInput {
  occurred_at: string; // ISO instantáneo (con zona)
  type: TxnType;
  amount: number;
  currency: Currency;
  exchange_rate?: number | null;
  account_id?: string | null;
  category_id?: string | null;
  description?: string | null;
}

/** Valida el payload. Devuelve mensaje de error o null si es válido. */
export function validarTransaccion(input: TransaccionInput): string | null {
  if (!input.occurred_at || Number.isNaN(new Date(input.occurred_at).getTime())) {
    return "Fecha y hora inválidas.";
  }
  if (input.type !== "gasto" && input.type !== "ingreso") {
    return "Tipo inválido (gasto o ingreso).";
  }
  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || input.amount <= 0) {
    return "El monto debe ser mayor a 0.";
  }
  if (!["BOB", "USD", "USDT"].includes(input.currency)) {
    return "Moneda inválida.";
  }
  if (input.currency !== "BOB") {
    if (!input.exchange_rate || input.exchange_rate <= 0) {
      return "Con moneda distinta a BOB, el tipo de cambio (T/C) es obligatorio y > 0.";
    }
  }
  return null;
}

function filaDesde(input: TransaccionInput) {
  return {
    occurred_at: input.occurred_at,
    txn_date: isoAFechaBolivia(input.occurred_at),
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    exchange_rate: input.currency === "BOB" ? null : input.exchange_rate ?? null,
    account_id: input.account_id || null,
    category_id: input.category_id || null,
    description: input.description?.trim() || null,
    source: "manual" as const,
  };
}

export async function crearTransaccion(
  supabase: SupabaseClient,
  input: TransaccionInput
): Promise<string> {
  const { data, error } = await supabase
    .from("transactions")
    .insert(filaDesde(input))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarTransaccion(
  supabase: SupabaseClient,
  id: string,
  input: TransaccionInput
): Promise<void> {
  const { error } = await supabase.from("transactions").update(filaDesde(input)).eq("id", id);
  if (error) throw error;
}

export async function borrarTransaccion(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
