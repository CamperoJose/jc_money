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

// --- Catálogos y transacciones (Gastos / Parámetros) ------------------------

export type CategoryKind = "gasto" | "ingreso" | "inversion";
export type TxnType = "gasto" | "ingreso";
export type TxnSource = "manual" | "voz" | "api";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  active: boolean;
}

export interface Transaction {
  id: string;
  occurred_at: string; // ISO con zona
  txn_date: string; // YYYY-MM-DD (fecha local Bolivia)
  type: TxnType;
  amount: number;
  currency: Currency;
  exchange_rate: number | null;
  account_id: string | null;
  category_id: string | null;
  description: string | null;
  tags: string[];
  source: TxnSource;
}

/** Transacción con catálogos resueltos para la UI. */
export interface TransactionUI extends Transaction {
  account: Account | null;
  category: Category | null;
  /** Monto convertido a BOB con el T/C de la transacción (o 1 si es BOB). */
  amount_bob: number;
}

export type SnapshotKind = "manual" | "auto";

export interface NetWorthSnapshot {
  id: string;
  snapshot_date: string; // YYYY-MM-DD
  snapshot_at: string; // ISO con zona (instante exacto de la foto)
  kind: SnapshotKind; // manual (ingresada) | auto (job diario)
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
