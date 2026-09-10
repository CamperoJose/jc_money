// Tipos del dominio, alineados con supabase/migrations/0001_schema_inicial.sql

export type Currency = "BOB" | "USD" | "USDT";

export type AccountType = "banco" | "efectivo" | "stablecoin" | "tarjeta_credito" | "dpf" | "por_cobrar" | "otro";

export interface Account { id: string; name: string; type: AccountType; currency: Currency; is_liability: boolean; active: boolean; }

export type CategoryKind = "gasto" | "ingreso" | "inversion";
export type TxnType = "gasto" | "ingreso";
export type TxnSource = "manual" | "voz" | "api";

export interface Category { id: string; name: string; kind: CategoryKind; parent_id: string | null; active: boolean; }

export interface Transaction { id: string; occurred_at: string; txn_date: string; type: TxnType; amount: number; currency: Currency; exchange_rate: number | null; account_id: string | null; category_id: string | null; description: string | null; tags: string[]; source: TxnSource; }
export interface TransactionUI extends Transaction { account: Account | null; category: Category | null; amount_bob: number; }

export type DpfStatus = "activo" | "pagado";
export type DpfLiberacion = "activo" | "por_liberar" | "vencido" | "pagado";
export interface DpfDeposit { id: string; nro_dpf: string | null; pizarra: string | null; edv: string | null; id_dpf_externo: string | null; start_date: string; end_date: string; principal: number; term_months: number; annual_rate: number; status: DpfStatus; cobra_iva: boolean; gcia_economica: number | null; gcia_financiera: number | null; rc_iva_retencion: number | null; paid_account_id: string | null; paid_at: string | null; notes: string | null; }
export interface DpfDepositUI extends DpfDeposit { interesMensual: number; interesBruto: number; interesLiquido: number; rcIva: number; montoAlVencimiento: number; paidAccount: Account | null; diasRestantes: number; diasTotales: number; diasTranscurridos: number; progreso: number; liberacion: DpfLiberacion; }

export interface Budget { id: string; period: string; category_id: string; amount_planned: number; }
export type BudgetEstado = "sin_presupuesto" | "ok" | "alerta" | "excedido";
export interface BudgetUI { category_id: string; category_name: string; planned: number; spent: number; restante: number; pct: number; estado: BudgetEstado; budget_id: string | null; }

export type DebtStatus = "pendiente" | "parcial" | "pagado";
export interface Debt { id: string; debt_date: string; amount: number; paid_amount: number; reason: string | null; counterparty: string | null; status: DebtStatus; due_date: string | null; source_account_id: string | null; paid_account_id: string | null; collected_date: string | null; }
export interface DebtUI extends Debt { outstanding: number; vencida: boolean; diasVencida: number | null; sourceAccount?: Account | null; paidAccount?: Account | null; }

export type AssetStatus = "activo" | "vendido";
export interface Asset { id: string; name: string; category: string | null; acquired_date: string | null; acquisition_cost: number; currency: Currency; current_value: number | null; sellable: boolean; counts_in_patrimonio: boolean; status: AssetStatus; sold_date: string | null; sold_price: number | null; sold_account_id: string | null; notes: string | null; }
export interface AssetUI extends Asset { valorActual: number; resultado: number; resultadoPct: number | null; realizado: boolean; diasTenencia: number | null; soldAccount?: Account | null; }

export interface ExchangeRate { id: string; rate_date: string; cod_indicador: number; cod_moneda: number; moneda_desc: string | null; valor: number; source: string; fetched_at: string; }
export interface TcConfig { cod_indicador: number; cod_moneda: number; }

export type AiRequestStatus = "procesando" | "completado" | "parcial" | "incompleto" | "error";
export interface AiRequest { id: string; created_at: string; processed_at: string | null; origen: string; status: AiRequestStatus; transcripcion: string | null; n_gastos: number; n_ingresos: number; n_deudas: number; resumen: string | null; error: string | null; correo_ok: boolean; }

export type SnapshotKind = "manual" | "auto";
export interface NetWorthSnapshot { id: string; snapshot_date: string; snapshot_at: string; kind: SnapshotKind; exchange_rate: number; total_bob: number | null; total_usd: number | null; note: string | null; }
export interface NetWorthBalance { id: string; snapshot_id: string; account_id: string; amount: number; }
export interface SnapshotConDetalle extends NetWorthSnapshot { balances: (NetWorthBalance & { account: Account })[]; }
