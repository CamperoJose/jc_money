import type { SupabaseClient } from "@supabase/supabase-js";
import type { Debt } from "@/lib/types";
import { resumenDeudas, type ResumenDeudas } from "@/lib/deudas";

const CAMPOS = "id, debt_date, amount, paid_amount, reason, counterparty, status, due_date";

function aDebt(r: Record<string, unknown>): Debt {
  return {
    id: r.id as string,
    debt_date: r.debt_date as string,
    amount: Number(r.amount),
    paid_amount: r.paid_amount != null ? Number(r.paid_amount) : 0,
    reason: (r.reason as string) ?? null,
    counterparty: (r.counterparty as string) ?? null,
    status: (r.status as Debt["status"]) ?? "pendiente",
    due_date: (r.due_date as string) ?? null,
  };
}

export async function getDeudas(supabase: SupabaseClient): Promise<Debt[]> {
  const { data, error } = await supabase
    .from("debts")
    .select(CAMPOS)
    .order("debt_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => aDebt(r as Record<string, unknown>));
}

export async function getResumenDeudas(supabase: SupabaseClient): Promise<ResumenDeudas> {
  const deudas = await getDeudas(supabase);
  return resumenDeudas(deudas);
}
