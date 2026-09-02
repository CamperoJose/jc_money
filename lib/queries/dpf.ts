import type { SupabaseClient } from "@supabase/supabase-js";
import type { DpfDeposit } from "@/lib/types";
import { resumenDpf, type ResumenDpf } from "@/lib/dpf";

const CAMPOS =
  "id, nro_dpf, pizarra, edv, id_dpf_externo, start_date, end_date, principal, term_days, annual_rate, status, gcia_economica, gcia_financiera, rc_iva_retencion, notes";

function aDeposit(r: Record<string, unknown>): DpfDeposit {
  return {
    id: r.id as string,
    nro_dpf: (r.nro_dpf as string) ?? null,
    pizarra: (r.pizarra as string) ?? null,
    edv: (r.edv as string) ?? null,
    id_dpf_externo: (r.id_dpf_externo as string) ?? null,
    start_date: r.start_date as string,
    end_date: r.end_date as string,
    principal: Number(r.principal),
    term_days: Number(r.term_days),
    annual_rate: Number(r.annual_rate),
    status: (r.status as DpfDeposit["status"]) ?? "activo",
    gcia_economica: r.gcia_economica != null ? Number(r.gcia_economica) : null,
    gcia_financiera: r.gcia_financiera != null ? Number(r.gcia_financiera) : null,
    rc_iva_retencion: r.rc_iva_retencion != null ? Number(r.rc_iva_retencion) : null,
    notes: (r.notes as string) ?? null,
  };
}

/** Todos los DPF del usuario, ordenados por fecha de inicio descendente. */
export async function getDpfs(supabase: SupabaseClient): Promise<DpfDeposit[]> {
  const { data, error } = await supabase
    .from("dpf_deposits")
    .select(CAMPOS)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => aDeposit(r as Record<string, unknown>));
}

/** Panel de indicadores de la cartera de DPF. */
export async function getResumenDpf(supabase: SupabaseClient): Promise<ResumenDpf> {
  const deposits = await getDpfs(supabase);
  return resumenDpf(deposits);
}
