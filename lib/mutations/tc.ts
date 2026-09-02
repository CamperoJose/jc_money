import type { SupabaseClient } from "@supabase/supabase-js";
import type { TcConfig } from "@/lib/types";

export interface UpsertRateInput {
  rate_date: string; // YYYY-MM-DD
  cod_indicador: number;
  cod_moneda: number;
  moneda_desc?: string | null;
  valor: number;
  source?: string;
  user_id?: string; // requerido cuando se usa la service role (job)
}

/**
 * Inserta/actualiza el T/C de un día (idempotente por
 * user_id + rate_date + cod_indicador + cod_moneda).
 */
export async function upsertExchangeRate(
  supabase: SupabaseClient,
  input: UpsertRateInput
): Promise<void> {
  const fila: Record<string, unknown> = {
    rate_date: input.rate_date,
    cod_indicador: input.cod_indicador,
    cod_moneda: input.cod_moneda,
    moneda_desc: input.moneda_desc ?? null,
    valor: Math.round(input.valor * 100000) / 100000,
    source: input.source ?? "bcb",
    fetched_at: new Date().toISOString(),
  };
  if (input.user_id) fila.user_id = input.user_id;
  const { error } = await supabase
    .from("exchange_rates")
    .upsert(fila, { onConflict: "user_id,rate_date,cod_indicador,cod_moneda" });
  if (error) throw error;
}

/** Guarda la configuración de T/C en app_settings. */
export async function setTcConfig(supabase: SupabaseClient, config: TcConfig): Promise<void> {
  const filas = [
    { key: "tc_cod_indicador", value: String(config.cod_indicador) },
    { key: "tc_cod_moneda", value: String(config.cod_moneda) },
  ];
  const { error } = await supabase.from("app_settings").upsert(filas, { onConflict: "user_id,key" });
  if (error) throw error;
}
