import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Currency } from "@/lib/types";
import {
  calcularTotalBob,
  calcularTotalUsd,
  distribucionPorMoneda,
} from "@/lib/patrimonio";

export interface BalanceUI {
  id: string;
  account_id: string;
  amount: number;
  account: Account;
}

export interface SnapshotUI {
  id: string;
  snapshot_date: string;
  exchange_rate: number;
  note: string | null;
  total_bob: number;
  total_usd: number;
  balances: BalanceUI[];
}

export interface ResumenPatrimonio {
  snapshots: SnapshotUI[];
  serie: { fecha: string; bob: number; usd: number }[];
  ultimo: SnapshotUI | null;
  anterior: SnapshotUI | null;
  variacionBob: number | null;
  variacionPct: number | null;
  distribucionMoneda: Record<Currency, number> | null;
}

/**
 * Lee todas las fotos de patrimonio con sus balances y cuentas, y calcula los
 * totales BOB/USD con la regla del negocio (no confía en el total almacenado).
 * Usado tanto por la API como por la página (fuente única de verdad).
 */
export async function getSnapshots(
  supabase: SupabaseClient
): Promise<SnapshotUI[]> {
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, exchange_rate, note, net_worth_balances(id, account_id, amount, accounts(id, name, type, currency, is_liability, active))"
    )
    .order("snapshot_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((s: Record<string, unknown>) => {
    const balances: BalanceUI[] = (
      (s.net_worth_balances as Record<string, unknown>[]) ?? []
    ).map((b) => ({
      id: b.id as string,
      account_id: b.account_id as string,
      amount: Number(b.amount),
      account: b.accounts as Account,
    }));

    const rate = Number(s.exchange_rate);
    const totalBob = calcularTotalBob(balances, rate);
    const totalUsd = calcularTotalUsd(totalBob, rate);

    return {
      id: s.id as string,
      snapshot_date: s.snapshot_date as string,
      exchange_rate: rate,
      note: (s.note as string) ?? null,
      total_bob: totalBob,
      total_usd: totalUsd,
      balances,
    };
  });
}

/** Arma el resumen para el dashboard a partir de las fotos. */
export async function getResumen(
  supabase: SupabaseClient
): Promise<ResumenPatrimonio> {
  const snapshots = await getSnapshots(supabase);
  const serie = snapshots.map((s) => ({
    fecha: s.snapshot_date,
    bob: s.total_bob,
    usd: s.total_usd,
  }));

  const ultimo = snapshots.at(-1) ?? null;
  const anterior = snapshots.length >= 2 ? snapshots.at(-2)! : null;

  let variacionBob: number | null = null;
  let variacionPct: number | null = null;
  if (ultimo && anterior) {
    variacionBob = Math.round((ultimo.total_bob - anterior.total_bob) * 100) / 100;
    variacionPct = anterior.total_bob
      ? variacionBob / anterior.total_bob
      : null;
  }

  const distribucionMoneda = ultimo
    ? distribucionPorMoneda(ultimo.balances, ultimo.exchange_rate)
    : null;

  return {
    snapshots,
    serie,
    ultimo,
    anterior,
    variacionBob,
    variacionPct,
    distribucionMoneda,
  };
}
