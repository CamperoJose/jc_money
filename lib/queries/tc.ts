import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExchangeRate, TcConfig } from "@/lib/types";

const CAMPOS = "id, rate_date, cod_indicador, cod_moneda, moneda_desc, valor, source, fetched_at";

const DEFAULT_CONFIG: TcConfig = { cod_indicador: 1, cod_moneda: 35 };

function aRate(r: Record<string, unknown>): ExchangeRate {
  return {
    id: r.id as string,
    rate_date: r.rate_date as string,
    cod_indicador: Number(r.cod_indicador),
    cod_moneda: Number(r.cod_moneda),
    moneda_desc: (r.moneda_desc as string) ?? null,
    valor: Number(r.valor),
    source: (r.source as string) ?? "bcb",
    fetched_at: r.fetched_at as string,
  };
}

/** Configuración de T/C desde app_settings (con defaults). */
export async function getTcConfig(supabase: SupabaseClient): Promise<TcConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["tc_cod_indicador", "tc_cod_moneda"]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    cod_indicador: Number(map.get("tc_cod_indicador") ?? DEFAULT_CONFIG.cod_indicador),
    cod_moneda: Number(map.get("tc_cod_moneda") ?? DEFAULT_CONFIG.cod_moneda),
  };
}

/** Historial de T/C (más reciente primero), opcionalmente por moneda. */
export async function getExchangeRates(
  supabase: SupabaseClient,
  codMoneda?: number
): Promise<ExchangeRate[]> {
  let q = supabase.from("exchange_rates").select(CAMPOS).order("rate_date", { ascending: false });
  if (codMoneda != null) q = q.eq("cod_moneda", codMoneda);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => aRate(r as Record<string, unknown>));
}

/**
 * Último T/C registrado en o antes de `date` (YYYY-MM-DD) para la moneda dada.
 * Se usa para prellenar el T/C de una foto de patrimonio manual.
 */
export async function getUltimoTc(
  supabase: SupabaseClient,
  date: string,
  codMoneda: number
): Promise<ExchangeRate | null> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select(CAMPOS)
    .eq("cod_moneda", codMoneda)
    .lte("rate_date", date)
    .order("rate_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? aRate(row as Record<string, unknown>) : null;
}
