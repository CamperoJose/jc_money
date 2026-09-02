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

export interface DistribucionCuenta {
  account_id: string;
  nombre: string;
  tipo: string;
  moneda: Currency;
  is_liability: boolean;
  montoOriginal: number;
  montoBob: number;
  pct: number;
}

export interface ResumenPatrimonio {
  snapshots: SnapshotUI[];
  serie: { fecha: string; bob: number; usd: number; variacion: number | null }[];
  ultimo: SnapshotUI | null;
  anterior: SnapshotUI | null;
  primero: SnapshotUI | null;
  variacionBob: number | null;
  variacionPct: number | null;
  variacionTotalBob: number | null;
  variacionTotalPct: number | null;
  maxBob: number | null;
  minBob: number | null;
  promedioBob: number | null;
  distribucionMoneda: Record<Currency, number> | null;
  distribucionCuentas: DistribucionCuenta[];
}

/** Lista de cuentas/billeteras del usuario (para el formulario de registro). */
export async function getCuentas(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, currency, is_liability, active")
    .order("is_liability", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Account[];
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
  const serie = snapshots.map((s, i) => {
    const prev = i > 0 ? snapshots[i - 1].total_bob : null;
    return {
      fecha: s.snapshot_date,
      bob: s.total_bob,
      usd: s.total_usd,
      variacion: prev != null ? Math.round((s.total_bob - prev) * 100) / 100 : null,
    };
  });

  const ultimo = snapshots.at(-1) ?? null;
  const anterior = snapshots.length >= 2 ? snapshots.at(-2)! : null;
  const primero = snapshots.at(0) ?? null;

  let variacionBob: number | null = null;
  let variacionPct: number | null = null;
  if (ultimo && anterior) {
    variacionBob = Math.round((ultimo.total_bob - anterior.total_bob) * 100) / 100;
    variacionPct = anterior.total_bob ? variacionBob / anterior.total_bob : null;
  }

  let variacionTotalBob: number | null = null;
  let variacionTotalPct: number | null = null;
  if (ultimo && primero && ultimo !== primero) {
    variacionTotalBob = Math.round((ultimo.total_bob - primero.total_bob) * 100) / 100;
    variacionTotalPct = primero.total_bob ? variacionTotalBob / primero.total_bob : null;
  }

  const totales = snapshots.map((s) => s.total_bob);
  const maxBob = totales.length ? Math.max(...totales) : null;
  const minBob = totales.length ? Math.min(...totales) : null;
  const promedioBob = totales.length
    ? Math.round((totales.reduce((a, b) => a + b, 0) / totales.length) * 100) / 100
    : null;

  const distribucionMoneda = ultimo
    ? distribucionPorMoneda(ultimo.balances, ultimo.exchange_rate)
    : null;

  // Distribución por cuenta (última foto), ordenada de mayor a menor en BOB.
  let distribucionCuentas: DistribucionCuenta[] = [];
  if (ultimo) {
    const rate = ultimo.exchange_rate;
    const totalPos = ultimo.balances.reduce((acc, b) => {
      const bob = b.account.currency === "BOB" ? b.amount : b.amount * rate;
      return acc + (b.account.is_liability ? 0 : bob);
    }, 0);
    distribucionCuentas = ultimo.balances
      .map((b) => {
        const montoBob = b.account.currency === "BOB" ? b.amount : b.amount * rate;
        return {
          account_id: b.account_id,
          nombre: b.account.name,
          tipo: b.account.type,
          moneda: b.account.currency,
          is_liability: b.account.is_liability,
          montoOriginal: Math.round(b.amount * 100) / 100,
          montoBob: Math.round(montoBob * 100) / 100,
          pct: totalPos && !b.account.is_liability ? montoBob / totalPos : 0,
        };
      })
      .sort((a, b) => b.montoBob - a.montoBob);
  }

  return {
    snapshots,
    serie,
    ultimo,
    anterior,
    primero,
    variacionBob,
    variacionPct,
    variacionTotalBob,
    variacionTotalPct,
    maxBob,
    minBob,
    promedioBob,
    distribucionMoneda,
    distribucionCuentas,
  };
}
