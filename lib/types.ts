// Tipos del dominio, alineados con supabase/migrations/0001_schema_inicial.sql

export type Currency = "BOB" | "USD" | "USDT";

export type AccountType =
  | "banco"
  | "efectivo"
  | "stablecoin"
  | "tarjeta_credito"
  | "dpf"
  | "por_cobrar"
  | "otro";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  is_liability: boolean;
  active: boolean;
}

export interface NetWorthSnapshot {
  id: string;
  snapshot_date: string; // YYYY-MM-DD
  exchange_rate: number;
  total_bob: number | null;
  total_usd: number | null;
  note: string | null;
}

export interface NetWorthBalance {
  id: string;
  snapshot_id: string;
  account_id: string;
  amount: number;
}

/** Foto con sus balances y cuentas resueltas (para cálculo y UI). */
export interface SnapshotConDetalle extends NetWorthSnapshot {
  balances: (NetWorthBalance & { account: Account })[];
}
