import type { SupabaseClient } from "@supabase/supabase-js";
import { isoAFechaBolivia } from "@/lib/datetime";
import { getTcConfig, getUltimoTc } from "@/lib/queries/tc";
import type { Currency, TxnSource, TxnType } from "@/lib/types";

export interface TransaccionInput {
  occurred_at: string; // ISO instantáneo (con zona)
  type: TxnType;
  amount: number;
  currency: Currency;
  exchange_rate?: number | null;
  account_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  source?: TxnSource; // 'manual' (por defecto) | 'voz' | 'api'
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
  // El servidor obtiene el T/C real del BCB antes de guardar. Si el cliente lo
  // manda, solo validamos que no sea un valor inválido; no confiamos en él.
  if (input.currency !== "BOB" && input.exchange_rate != null && input.exchange_rate <= 0) {
    return "El tipo de cambio enviado es inválido.";
  }
  return null;
}

function filaDesde(input: TransaccionInput, exchangeRate?: number | null) {
  return {
    occurred_at: input.occurred_at,
    txn_date: isoAFechaBolivia(input.occurred_at),
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    exchange_rate: input.currency === "BOB" ? null : exchangeRate ?? input.exchange_rate ?? null,
    account_id: input.account_id || null,
    category_id: input.category_id || null,
    description: input.description?.trim() || null,
    source: input.source ?? "manual",
  };
}

/**
 * El T/C almacenado en una transacción no se toma del cliente cuando existe una
 * cotización BCB disponible. Así, voz, formulario y API guardan exactamente el
 * mismo T/C histórico para la fecha del movimiento.
 */
async function obtenerTcHistorico(supabase: SupabaseClient, input: TransaccionInput, userId?: string): Promise<number | null> {
  if (input.currency === "BOB") return null;
  const fecha = isoAFechaBolivia(input.occurred_at);
  const cfg = await getTcConfig(supabase, userId);
  const row = await getUltimoTc(supabase, fecha, cfg.cod_moneda, userId, cfg.cod_indicador);
  if (row?.valor && row.valor > 0) return row.valor;
  throw new Error(`No existe un tipo de cambio disponible para ${fecha}.`);
}

export async function crearTransaccion(
  supabase: SupabaseClient,
  input: TransaccionInput,
  userId?: string
): Promise<string> {
  // Con la service role (jobs/ingesta) auth.uid() es null, así que el user_id
  // debe ir explícito; con sesión, se omite y aplica el default auth.uid().
  const rate = await obtenerTcHistorico(supabase, input, userId);
  const fila = userId ? { ...filaDesde(input, rate), user_id: userId } : filaDesde(input, rate);
  const { data, error } = await supabase.from("transactions").insert(fila).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarTransaccion(
  supabase: SupabaseClient,
  id: string,
  input: TransaccionInput
): Promise<void> {
  const rate = await obtenerTcHistorico(supabase, input);
  const { error } = await supabase.from("transactions").update(filaDesde(input, rate)).eq("id", id);
  if (error) throw error;
}

export async function borrarTransaccion(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
