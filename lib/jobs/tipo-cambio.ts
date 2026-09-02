import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import {
  obtenerTipoCambioBCB,
  diagnosticarTipoCambioBCB,
  descripcionMoneda,
} from "@/lib/bcb";

export interface ResultadoTcJob {
  ok: boolean;
  reason?: string;
  rate_date?: string;
  cod_indicador?: number;
  cod_moneda?: number;
  valor?: number;
}

/** user_id del único usuario de la app (leído con service role). */
async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  for (const tabla of ["net_worth_snapshots", "accounts", "app_settings", "transactions"]) {
    const { data, error } = await admin.from(tabla).select("user_id").limit(1);
    if (error) throw error;
    if (data && data.length > 0) return (data[0] as { user_id: string }).user_id;
  }
  return null;
}

async function leerConfig(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", [
      "tc_cod_indicador",
      "tc_cod_moneda",
      "tc_bcb_namespace",
      "tc_bcb_soap_action",
      "tc_bcb_param_names",
    ]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  const paramsRaw = map.get("tc_bcb_param_names");
  return {
    codIndicador: Number(map.get("tc_cod_indicador") ?? 1),
    codMoneda: Number(map.get("tc_cod_moneda") ?? 35),
    namespace: map.get("tc_bcb_namespace") || undefined,
    soapAction: map.get("tc_bcb_soap_action") || undefined,
    paramNames: paramsRaw ? paramsRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  };
}

/**
 * Diagnóstico: ejecuta la consulta al BCB y devuelve el sobre enviado, el XML
 * crudo y el parseo, sin persistir nada. Para depurar el servicio en prod.
 */
export async function diagnosticarTC(
  admin: SupabaseClient,
  opts?: { targetDate?: string; fetchImpl?: typeof fetch }
) {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const targetDate = opts?.targetDate ?? fechaBoliviaHoy();
  const userId = await getUsuarioId(admin);
  if (!userId) throw new Error("No hay usuarios en la app.");
  const cfg = await leerConfig(admin, userId);
  const diag = await diagnosticarTipoCambioBCB(fetchImpl, {
    codIndicador: cfg.codIndicador,
    codMoneda: cfg.codMoneda,
    fechaISO: targetDate,
    namespace: cfg.namespace,
    paramNames: cfg.paramNames,
    soapAction: cfg.soapAction,
  });
  return { ...diag, rate_date: targetDate, cod_indicador: cfg.codIndicador, cod_moneda: cfg.codMoneda };
}

/**
 * Consulta al BCB el T/C del DÍA EN CURSO (Bolivia) y lo registra en
 * exchange_rates (idempotente por día/indicador/moneda). Usa la service role,
 * así que el user_id va explícito.
 */
export async function ejecutarTipoCambioBCB(
  admin: SupabaseClient,
  opts?: { targetDate?: string; fetchImpl?: typeof fetch }
): Promise<ResultadoTcJob> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const targetDate = opts?.targetDate ?? fechaBoliviaHoy(); // DÍA EN CURSO

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  const cfg = await leerConfig(admin, userId);

  const r = await obtenerTipoCambioBCB(fetchImpl, {
    codIndicador: cfg.codIndicador,
    codMoneda: cfg.codMoneda,
    fechaISO: targetDate,
    namespace: cfg.namespace,
    paramNames: cfg.paramNames,
    soapAction: cfg.soapAction,
  });

  const valor = r.valor as number;
  const { error } = await admin.from("exchange_rates").upsert(
    {
      user_id: userId,
      rate_date: targetDate,
      cod_indicador: cfg.codIndicador,
      cod_moneda: cfg.codMoneda,
      moneda_desc: descripcionMoneda(cfg.codMoneda),
      valor: Math.round(valor * 100000) / 100000,
      source: "bcb",
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,rate_date,cod_indicador,cod_moneda" }
  );
  if (error) throw error;

  return {
    ok: true,
    rate_date: targetDate,
    cod_indicador: cfg.codIndicador,
    cod_moneda: cfg.codMoneda,
    valor,
  };
}
