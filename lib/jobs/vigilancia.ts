// Vigilancia del cierre diario: avisa por correo si el job de patrimonio no
// corrió. Vive en un horario distinto (media mañana) y en un workflow aparte,
// justamente para no depender del mismo disparo que está vigilando.
//
// Lo que NO cubre: si GitHub Actions se cae entero, esto tampoco corre. Es el
// límite conocido de vigilar desde el mismo scheduler; se acepta porque la
// alternativa cuesta dinero (decisión: costo cero).

import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo, leerConfigCorreo } from "@/lib/mailer";
import { htmlCierreNoCorrio } from "@/lib/emails/plantillas";
import { leerAviso, guardarAviso } from "@/lib/jobs/avisos";

const CLAVE_AVISO = "aviso_cierre_no_corrio";

/** Días de tolerancia: el cierre de "ayer" corre a las 00:17 de hoy. */
const DIAS_GRACIA = 1;
/** Cuántos días hacia atrás se listan como faltantes en el correo. */
const MAX_DIAS_LISTADOS = 10;

export interface ResultadoVigilancia {
  ok: boolean;
  reason?: string;
  ultima_foto_auto?: string | null;
  dias_faltantes?: string[];
  aviso_enviado?: boolean;
}

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.from("accounts").select("user_id").limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as { user_id: string }).user_id : null;
}

export async function ejecutarVigilancia(
  admin: SupabaseClient,
  opts?: { targetDate?: string }
): Promise<ResultadoVigilancia> {
  const hoy = opts?.targetDate ?? fechaBoliviaHoy();
  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  // Fotos automáticas recientes: solo interesa el cierre del job, no las
  // manuales que el usuario pueda cargar a mano.
  const desde = restarDias(hoy, MAX_DIAS_LISTADOS + DIAS_GRACIA);
  const { data, error } = await admin
    .from("net_worth_snapshots")
    .select("snapshot_date")
    .eq("user_id", userId)
    .eq("kind", "auto")
    .gte("snapshot_date", desde)
    .order("snapshot_date", { ascending: false });
  if (error) throw error;

  const fechas = new Set((data ?? []).map((r) => r.snapshot_date as string));
  const ultima = (data ?? [])[0]?.snapshot_date as string | undefined;

  // Se espera una foto por cada día hasta "ayer" (el cierre de hoy corre
  // mañana). Los días de gracia evitan avisar por un retraso normal del cron.
  const faltantes: string[] = [];
  for (let i = DIAS_GRACIA; i <= MAX_DIAS_LISTADOS; i++) {
    const dia = restarDias(hoy, i);
    if (dia < desde) break;
    if (!fechas.has(dia)) faltantes.push(dia);
  }
  faltantes.reverse(); // del más viejo al más nuevo, como se leen

  if (faltantes.length === 0) {
    // Todo al día: se limpia la memoria para que el próximo hueco sí avise.
    await guardarAviso(admin, userId, CLAVE_AVISO, null);
    return { ok: true, ultima_foto_auto: ultima ?? null, dias_faltantes: [], aviso_enviado: false };
  }

  if (!leerConfigCorreo()) {
    return {
      ok: false,
      reason: "Faltan SMTP_USER/SMTP_PASS: no se puede avisar.",
      ultima_foto_auto: ultima ?? null,
      dias_faltantes: faltantes,
    };
  }

  // Un solo aviso por hueco: se reenvía únicamente si aparecen días nuevos.
  const previo = await leerAviso<{ ultimoAvisado: string }>(admin, userId, CLAVE_AVISO);
  const masReciente = faltantes[faltantes.length - 1];
  if (previo?.ultimoAvisado === masReciente) {
    return {
      ok: true,
      ultima_foto_auto: ultima ?? null,
      dias_faltantes: faltantes,
      aviso_enviado: false,
    };
  }

  const correo = htmlCierreNoCorrio(faltantes, ultima ?? null);
  await enviarCorreo({ subject: correo.subject, html: correo.html, text: correo.text });
  await guardarAviso(admin, userId, CLAVE_AVISO, { ultimoAvisado: masReciente });

  return {
    ok: true,
    ultima_foto_auto: ultima ?? null,
    dias_faltantes: faltantes,
    aviso_enviado: true,
  };
}
