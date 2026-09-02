import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebtStatus } from "@/lib/types";

export interface DebtInput {
  debt_date: string; // YYYY-MM-DD
  amount: number;
  paid_amount?: number | null;
  reason?: string | null;
  counterparty?: string | null;
  status?: DebtStatus;
  due_date?: string | null;
}

export function validarDeuda(input: DebtInput): string | null {
  if (!input.debt_date || Number.isNaN(Date.parse(`${input.debt_date}T00:00:00Z`))) {
    return "La fecha es inválida.";
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "El monto debe ser mayor a 0.";
  }
  if (input.paid_amount != null && (input.paid_amount < 0 || input.paid_amount > input.amount)) {
    return "Lo cobrado debe estar entre 0 y el monto total.";
  }
  if (input.status && !["pendiente", "parcial", "pagado"].includes(input.status)) {
    return "Estado inválido.";
  }
  if (input.due_date && Number.isNaN(Date.parse(`${input.due_date}T00:00:00Z`))) {
    return "La fecha de cobro es inválida.";
  }
  return null;
}

function limpiar(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function filaDesde(input: DebtInput) {
  const amount = Math.round(input.amount * 100) / 100;
  const paid = Math.round(Math.min(Math.max(input.paid_amount ?? 0, 0), amount) * 100) / 100;
  // Estado derivado si no viene explícito: pagado si saldó, parcial si algo, pendiente si nada.
  const status: DebtStatus =
    input.status ?? (paid >= amount ? "pagado" : paid > 0 ? "parcial" : "pendiente");
  return {
    debt_date: input.debt_date,
    amount,
    paid_amount: paid,
    reason: limpiar(input.reason),
    counterparty: limpiar(input.counterparty),
    status,
    due_date: input.due_date || null,
  };
}

export async function crearDeuda(supabase: SupabaseClient, input: DebtInput): Promise<string> {
  const { data, error } = await supabase.from("debts").insert(filaDesde(input)).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarDeuda(
  supabase: SupabaseClient,
  id: string,
  input: DebtInput
): Promise<void> {
  const { error } = await supabase.from("debts").update(filaDesde(input)).eq("id", id);
  if (error) throw error;
}

export async function borrarDeuda(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}
