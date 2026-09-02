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

// --- Inversiones DPF (hoja DPF LADDERING REAL) ------------------------------

export type DpfStatus = "activo" | "pagado";

/** Estado de liberación derivado (para la UI, no se almacena). */
export type DpfLiberacion = "activo" | "por_liberar" | "vencido" | "pagado";

export interface DpfDeposit {
  id: string;
  nro_dpf: string | null; // orden/etiqueta libre del usuario
  pizarra: string | null; // entidad financiera (Banco SOL, Fortaleza, …)
  edv: string | null; // registro EDV (opcional)
  id_dpf_externo: string | null; // Nº de DPF del banco
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  principal: number; // capital en BOB
  term_days: number; // plazo (ej. 90)
  annual_rate: number; // tasa anual (ej. 0.077)
  status: DpfStatus;
  cobra_iva: boolean; // si retiene RC-IVA (13%). Por defecto false.
  gcia_economica: number | null; // ganancia bruta realizada (override opcional)
  gcia_financiera: number | null; // ganancia líquida realizada (override opcional)
  rc_iva_retencion: number | null; // retención realizada (override opcional)
  paid_account_id: string | null; // cuenta/banco a la que se cobró (al pagar)
  paid_at: string | null; // fecha de cobro (YYYY-MM-DD)
  notes: string | null;
}

/** Cuenta a la que se cobró un DPF (resuelta para la UI). */
export interface DpfDepositUI extends DpfDeposit {
  interesDiario: number;
  interesBruto: number; // proyectado a fin de plazo
  interesLiquido: number; // cobra_iva ? bruto·0,87 : bruto
  rcIva: number; // cobra_iva ? bruto·0,13 : 0
  montoAlVencimiento: number; // principal + interés líquido
  paidAccount: Account | null; // cuenta de cobro resuelta
  diasRestantes: number; // end_date − hoy (negativo si venció)
  diasTotales: number; // end_date − start_date
  diasTranscurridos: number;
  progreso: number; // 0..1
  liberacion: DpfLiberacion;
}

// --- Tipo de cambio (BCB) ---------------------------------------------------

export interface ExchangeRate {
  id: string;
  rate_date: string; // YYYY-MM-DD
  cod_indicador: number;
  cod_moneda: number;
  moneda_desc: string | null;
  valor: number; // Bs por unidad de moneda
  source: string; // 'bcb' | 'manual'
  fetched_at: string;
}

/** Configuración paramétrica del consumo de T/C. */
export interface TcConfig {
  cod_indicador: number;
  cod_moneda: number;
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
