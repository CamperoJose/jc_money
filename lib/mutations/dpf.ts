import type { SupabaseClient } from "@supabase/supabase-js";
import type { DpfStatus } from "@/lib/types";
import { sumarDias, interesBruto, interesLiquido } from "@/lib/dpf";

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
  gcia_economica?: number | null;
  gcia_financiera?: number | null;
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
  const endDate = input.end_date || sumarDias(input.start_date, term);
  // Ganancia realizada: si el usuario no la entrega, se proyecta desde el capital.
  const bruto = input.gcia_economica ?? interesBruto(input.principal, input.annual_rate, term);
  const liquido = input.gcia_financiera ?? interesLiquido(bruto);
  return {
    pizarra: limpiar(input.pizarra),
    id_dpf_externo: limpiar(input.id_dpf_externo),
    edv: limpiar(input.edv),
    nro_dpf: limpiar(input.nro_dpf),
    start_date: input.start_date,
    end_date: endDate,
    principal: input.principal,
    term_days: term,
    annual_rate: input.annual_rate,
    status: input.status ?? "activo",
    gcia_economica: Math.round(bruto * 100) / 100,
    gcia_financiera: Math.round(liquido * 100) / 100,
    rc_iva_retencion: Math.round((bruto - liquido) * 100) / 100,
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
