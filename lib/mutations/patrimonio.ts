import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "@/lib/types";
import { calcularTotalBob, calcularTotalUsd } from "@/lib/patrimonio";
import { snapshotAtDesdeFecha } from "@/lib/datetime";

export interface RegistroInput {
  snapshot_date: string; // YYYY-MM-DD
  exchange_rate: number;
  note?: string | null;
  balances: { account_id: string; amount: number }[];
}

/** Valida el payload y devuelve un mensaje de error o null si es válido. */
export function validarRegistro(input: RegistroInput): string | null {
  if (!input.snapshot_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.snapshot_date)) {
    return "Fecha inválida (formato esperado YYYY-MM-DD).";
  }
  if (!input.exchange_rate || input.exchange_rate <= 0) {
    return "El tipo de cambio (T/C) debe ser mayor a 0.";
  }
  if (!Array.isArray(input.balances) || input.balances.length === 0) {
    return "Debes registrar al menos un saldo.";
  }
  return null;
}

async function totalesDesde(
  supabase: SupabaseClient,
  input: RegistroInput
): Promise<{ totalBob: number; totalUsd: number }> {
  const ids = input.balances.map((b) => b.account_id);
  const { data, error } = await supabase
    .from("accounts")
    .select("id, currency, is_liability")
    .in("id", ids);
  if (error) throw error;
  const mapa = new Map((data as Pick<Account, "id" | "currency" | "is_liability">[]).map((a) => [a.id, a]));

  const conCuenta = input.balances
    .filter((b) => mapa.has(b.account_id))
    .map((b) => ({ amount: b.amount, account: mapa.get(b.account_id)! }));

  const totalBob = calcularTotalBob(conCuenta, input.exchange_rate);
  const totalUsd = calcularTotalUsd(totalBob, input.exchange_rate);
  return { totalBob, totalUsd };
}

/** Crea una foto de patrimonio con sus balances. Devuelve el id nuevo. */
export async function crearRegistro(
  supabase: SupabaseClient,
  input: RegistroInput
): Promise<string> {
  const { totalBob, totalUsd } = await totalesDesde(supabase, input);

  const { data: snap, error: e1 } = await supabase
    .from("net_worth_snapshots")
    .insert({
      snapshot_date: input.snapshot_date,
      snapshot_at: snapshotAtDesdeFecha(input.snapshot_date),
      kind: "manual",
      exchange_rate: input.exchange_rate,
      total_bob: totalBob,
      total_usd: totalUsd,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const snapId = snap.id as string;
  const filas = input.balances
    .filter((b) => b.amount !== 0 || b.amount === 0) // conserva ceros (histórico fiel)
    .map((b) => ({ snapshot_id: snapId, account_id: b.account_id, amount: b.amount }));
  if (filas.length) {
    const { error: e2 } = await supabase.from("net_worth_balances").insert(filas);
    if (e2) throw e2;
  }
  return snapId;
}

/** Actualiza una foto: reemplaza cabecera y balances. */
export async function actualizarRegistro(
  supabase: SupabaseClient,
  id: string,
  input: RegistroInput
): Promise<void> {
  const { totalBob, totalUsd } = await totalesDesde(supabase, input);

  const { error: e1 } = await supabase
    .from("net_worth_snapshots")
    .update({
      snapshot_date: input.snapshot_date,
      snapshot_at: snapshotAtDesdeFecha(input.snapshot_date),
      exchange_rate: input.exchange_rate,
      total_bob: totalBob,
      total_usd: totalUsd,
      note: input.note?.trim() || null,
    })
    .eq("id", id);
  if (e1) throw e1;

  // Reemplaza balances (borra y reinserta — simple y consistente).
  const { error: e2 } = await supabase.from("net_worth_balances").delete().eq("snapshot_id", id);
  if (e2) throw e2;

  const filas = input.balances.map((b) => ({
    snapshot_id: id,
    account_id: b.account_id,
    amount: b.amount,
  }));
  if (filas.length) {
    const { error: e3 } = await supabase.from("net_worth_balances").insert(filas);
    if (e3) throw e3;
  }
}

/** Borra una foto (los balances caen por ON DELETE CASCADE). */
export async function borrarRegistro(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("net_worth_snapshots").delete().eq("id", id);
  if (error) throw error;
}
