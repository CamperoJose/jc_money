import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import {
  BINANCE_P2P_SOURCE,
  obtenerTipoCambioBinanceP2P,
} from "@/lib/dolar-blue-bolivia";

const DEFAULT_COD_INDICADOR = 1;
const DEFAULT_COD_MONEDA = 12;
const MONEDA_DESC = "USDT (Binance P2P compradores)";

export interface ResultadoTcJob {
  ok: boolean;
  reason?: string;
  rate_date?: string;
  cod_indicador?: number;
  cod_moneda?: number;
  valor?: number;
  source?: string;
  orders_validas?: number;
  orders_recibidas?: number;
  cached?: boolean;
  source_fetched_at?: string | null;
}

async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  const override = process.env.JOB_USER_ID;
  if (override) return override;

  for (const tabla of ["net_worth_snapshots", "accounts", "app_settings", "transactions"]) {
    const { data, error } = await admin.from(tabla).select("user_id").limit(1);
    if (error) throw error;
    if (data?.length) return (data[0] as { user_id: string }).user_id;
  }
  return null;
}

async function leerConfig(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", ["tc_cod_indicador", "tc_cod_moneda"]);

  if (error) throw error;

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    codIndicador: Number(map.get("tc_cod_indicador") ?? DEFAULT_COD_INDICADOR),
    codMoneda: Number(map.get("tc_cod_moneda") ?? DEFAULT_COD_MONEDA),
  };
}

export async function diagnosticarTC(
  admin: SupabaseClient,
  opts?: { targetDate?: string; fetchImpl?: typeof fetch }
) {
  const targetDate = opts?.targetDate ?? fechaBoliviaHoy();
  const hoy = fechaBoliviaHoy();

  if (targetDate !== hoy) {
    return {
      ok: false,
      reason:
        "Binance P2P entrega una cotización actual; no se permite asignarla a una fecha histórica.",
      rate_date: targetDate,
      today: hoy,
    };
  }

  const userId = await getUsuarioId(admin);
  if (!userId) throw new Error("No hay usuarios en la app.");

  const cfg = await leerConfig(admin, userId);
  const r = await obtenerTipoCambioBinanceP2P(opts?.fetchImpl ?? fetch);

  return {
    ok: true,
    rate_date: targetDate,
    cod_indicador: cfg.codIndicador,
    cod_moneda: cfg.codMoneda,
    source: BINANCE_P2P_SOURCE,
    metodo: "mediana",
    valor: r.valor,
    rates: r.rates,
    orders_validas: r.ordersValidas,
    orders_recibidas: r.ordersRecibidas,
    pair: r.pair,
    side: r.side,
    cached: r.cached,
    source_fetched_at: r.fetchedAt,
  };
}

export async function ejecutarTipoCambioBinanceP2P(
  admin: SupabaseClient,
  opts?: { targetDate?: string; fetchImpl?: typeof fetch }
): Promise<ResultadoTcJob> {
  const targetDate = opts?.targetDate ?? fechaBoliviaHoy();
  const hoy = fechaBoliviaHoy();

  if (targetDate !== hoy) {
    return {
      ok: false,
      reason:
        "Binance P2P entrega una cotización actual; no se permite guardar el precio de hoy como histórico.",
      rate_date: targetDate,
    };
  }

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  const cfg = await leerConfig(admin, userId);
  const r = await obtenerTipoCambioBinanceP2P(opts?.fetchImpl ?? fetch);
  const valor = r.valor;

  const { error } = await admin.from("exchange_rates").upsert(
    {
      rate_date: targetDate,
      cod_indicador: cfg.codIndicador,
      cod_moneda: cfg.codMoneda,
      moneda_desc: MONEDA_DESC,
      valor,
      source: BINANCE_P2P_SOURCE,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "rate_date,cod_indicador,cod_moneda" }
  );

  if (error) throw error;

  return {
    ok: true,
    rate_date: targetDate,
    cod_indicador: cfg.codIndicador,
    cod_moneda: cfg.codMoneda,
    valor,
    source: BINANCE_P2P_SOURCE,
    orders_validas: r.ordersValidas,
    orders_recibidas: r.ordersRecibidas,
    cached: r.cached,
    source_fetched_at: r.fetchedAt,
  };
}
