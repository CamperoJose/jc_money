import type { SupabaseClient } from "@supabase/supabase-js";
import type { DpfStatus } from "@/lib/types";
import { sumarDias, interesBruto, interesLiquido, redondeaTasa, redondeaMonto } from "@/lib/dpf";

export interface DpfInput {
  pizarra?: string | null; // entidad financiera
  id_dpf_externo?: string | null; // Nº de DPF del banco
  edv?: string | null;
  nro_dpf?: string | null;
  start_date: string; // YYYY-MM-DD
  term_days: number; // plazo (ej. 90)
  end_date?: string | null; // opcional; si falta se calcula = start + term
  principal: number; // capital BOB
  annual_rate: number; // ej. 0.077 (fracción, no %)
  status?: DpfStatus;
  cobra_iva?: boolean; // retiene RC-IVA (13%). Por defecto false.
  gcia_economica?: number | null;
  gcia_financiera?: number | null;
  paid_account_id?: string | null; // cuenta/banco a la que se cobró
  paid_at?: string | null; // fecha de cobro (YYYY-MM-DD)
  notes?: string | null;
}

/** Valida el payload. Devuelve mensaje de error o null si es válido. */
export function validarDpf(input: DpfInput): string | null {
  if (!input.start_date || Number.isNaN(Date.parse(`${input.start_date}T00:00:00Z`))) {
    return "La fecha de inicio es inválida.";
  }
  if (!Number.isFinite(input.term_days) || input.term_days <= 0) {
    return "El plazo (días) debe ser mayor a 0.";
  }
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return "El monto (capital) debe ser mayor a 0.";
  }
  if (!Number.isFinite(input.annual_rate) || input.annual_rate <= 0 || input.annual_rate > 1) {
    return "La tasa anual debe ser una fracción entre 0 y 1 (ej. 0.077 para 7,7%).";
  }
  if (input.status && input.status !== "activo" && input.status !== "pagado") {
    return "Estado inválido (activo o pagado).";
  }
  return null;
}

function limpiar(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function filaDesde(input: DpfInput) {
  const term = Math.round(input.term_days);
  const principal = redondeaMonto(input.principal);
  const rate = redondeaTasa(input.annual_rate); // mata el ruido de float (6.6% → 0.066)
  const cobraIva = input.cobra_iva ?? false;
  const status = input.status ?? "activo";
  const endDate = input.end_date || sumarDias(input.start_date, term);
  // Ganancia realizada: si el usuario no la entrega, se proyecta desde el capital.
  const bruto = redondeaMonto(input.gcia_economica ?? interesBruto(principal, rate, term));
  const liquido = redondeaMonto(input.gcia_financiera ?? interesLiquido(bruto, cobraIva));
  const pagado = status === "pagado";
  return {
    pizarra: limpiar(input.pizarra),
    id_dpf_externo: limpiar(input.id_dpf_externo),
    edv: limpiar(input.edv),
    nro_dpf: limpiar(input.nro_dpf),
    start_date: input.start_date,
    end_date: endDate,
    principal,
    term_days: term,
    annual_rate: rate,
    status,
    cobra_iva: cobraIva,
    gcia_economica: bruto,
    gcia_financiera: liquido,
    rc_iva_retencion: redondeaMonto(bruto - liquido),
    // El cobro solo aplica cuando está pagado; si no, se limpia.
    paid_account_id: pagado ? input.paid_account_id || null : null,
    paid_at: pagado ? input.paid_at || null : null,
    notes: limpiar(input.notes),
  };
}

export async function crearDpf(supabase: SupabaseClient, input: DpfInput): Promise<string> {
  const { data, error } = await supabase
    .from("dpf_deposits")
    .insert(filaDesde(input))
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarDpf(
  supabase: SupabaseClient,
  id: string,
  input: DpfInput
): Promise<void> {
  const { error } = await supabase.from("dpf_deposits").update(filaDesde(input)).eq("id", id);
  if (error) throw error;
}

export async function borrarDpf(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("dpf_deposits").delete().eq("id", id);
  if (error) throw error;
}
