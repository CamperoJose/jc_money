// Vigilancia del cierre diario: avisa por correo si el job de patrimonio no corrió.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo, leerConfigCorreo } from "@/lib/mailer";
import { htmlCierreNoCorrio } from "@/lib/emails/plantillas";
import { leerAviso, guardarAviso } from "@/lib/jobs/avisos";

const CLAVE_AVISO = "aviso_cierre_no_corrio";
const DIAS_GRACIA = 1;
const MAX_DIAS_LISTADOS = 10;
export interface ResultadoVigilancia { ok: boolean; reason?: string; ultima_foto_auto?: string | null; dias_faltantes?: string[]; aviso_enviado?: boolean; }
function restarDias(fecha: string, dias: number): string { const d = new Date(`${fecha}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - dias); return d.toISOString().slice(0, 10); }
async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  const override = process.env.JOB_USER_ID; if (override) return override;
  const { data, error } = await admin.from("accounts").select("user_id").limit(1); if (error) throw error;
  return data && data.length > 0 ? (data[0] as { user_id: string }).user_id : null;
}

export async function ejecutarVigilancia(admin: SupabaseClient, opts?: { targetDate?: string }): Promise<ResultadoVigilancia> {
  const hoy = opts?.targetDate ?? fechaBoliviaHoy(); const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };
  const desde = restarDias(hoy, MAX_DIAS_LISTADOS + DIAS_GRACIA);
  const { data, error } = await admin.from("net_worth_snapshots").select("snapshot_date").eq("user_id", userId).eq("kind", "auto").gte("snapshot_date", desde).order("snapshot_date", { ascending: false });
  if (error) throw error;
  const fechas = new Set((data ?? []).map(r => r.snapshot_date as string)); const ultima = (data ?? [])[0]?.snapshot_date as string | undefined;
  const { data: primeraFila, error: ePrimera } = await admin.from("net_worth_snapshots").select("snapshot_date").eq("user_id", userId).eq("kind", "auto").order("snapshot_date", { ascending: true }).limit(1);
  if (ePrimera) throw ePrimera;
  const primeraAuto = (primeraFila ?? [])[0]?.snapshot_date as string | undefined;
  if (!primeraAuto) return { ok: true, ultima_foto_auto: null, dias_faltantes: [], aviso_enviado: false };
  const faltantes: string[] = [];
  for (let i = DIAS_GRACIA; i <= MAX_DIAS_LISTADOS; i++) { const dia = restarDias(hoy, i); if (dia < desde || dia < primeraAuto) break; if (!fechas.has(dia)) faltantes.push(dia); }
  faltantes.reverse();
  if (!faltantes.length) { await guardarAviso(admin, userId, CLAVE_AVISO, null); return { ok: true, ultima_foto_auto: ultima ?? null, dias_faltantes: [], aviso_enviado: false }; }
  if (!leerConfigCorreo()) return { ok: false, reason: "Faltan SMTP_USER/SMTP_PASS: no se puede avisar.", ultima_foto_auto: ultima ?? null, dias_faltantes: faltantes };
  const previo = await leerAviso<{ ultimoAvisado: string }>(admin, userId, CLAVE_AVISO); const masReciente = faltantes[faltantes.length - 1];
  if (previo?.ultimoAvisado === masReciente) return { ok: true, ultima_foto_auto: ultima ?? null, dias_faltantes: faltantes, aviso_enviado: false };
  const correo = htmlCierreNoCorrio(faltantes, ultima ?? null);
  await enviarCorreo({ subject: correo.subject, html: correo.html, text: correo.text });
  await guardarAviso(admin, userId, CLAVE_AVISO, { ultimoAvisado: masReciente });
  return { ok: true, ultima_foto_auto: ultima ?? null, dias_faltantes: faltantes, aviso_enviado: true };
}
