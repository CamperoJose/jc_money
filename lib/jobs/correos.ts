import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo, leerConfigCorreo } from "@/lib/mailer";
import {
  htmlPatrimonioDiario,
  htmlDpfAlerta,
  type PatrimonioEmailData,
  type DpfAlertaItem,
} from "@/lib/emails/plantillas";
import { getDpfs } from "@/lib/queries/dpf";
import { resumenDpf } from "@/lib/dpf";

export interface ResultadoCorreos {
  ok: boolean;
  reason?: string;
  patrimonio_enviado?: boolean;
  alerta_enviada?: boolean;
  dpf_vencen_hoy?: number;
}

const TIPOS_LIQUIDOS = new Set(["banco", "efectivo", "stablecoin"]);

async function getUsuarioId(admin: SupabaseClient): Promise<string | null> {
  for (const t of ["net_worth_snapshots", "accounts", "app_settings", "transactions"]) {
    const { data, error } = await admin.from(t).select("user_id").limit(1);
    if (error) throw error;
    if (data && data.length > 0) return (data[0] as { user_id: string }).user_id;
  }
  return null;
}

interface BalRow {
  amount: number;
  account: { name: string; type: string; currency: string; is_liability: boolean };
}

/**
 * Envía el correo diario de patrimonio (mini-dash) y, si algún DPF vence hoy,
 * un correo aparte de alerta. Requiere SMTP_USER/SMTP_PASS en el entorno.
 */
export async function ejecutarCorreos(
  admin: SupabaseClient,
  opts?: { targetDate?: string }
): Promise<ResultadoCorreos> {
  if (!leerConfigCorreo()) {
    return { ok: false, reason: "Faltan SMTP_USER/SMTP_PASS: no se envían correos." };
  }
  const hoy = opts?.targetDate ?? fechaBoliviaHoy();

  const userId = await getUsuarioId(admin);
  if (!userId) return { ok: false, reason: "No hay usuarios en la app." };

  // Últimas 2 fotos con sus balances y cuentas.
  const { data: snaps, error: eSnap } = await admin
    .from("net_worth_snapshots")
    .select(
      "id, snapshot_date, exchange_rate, total_bob, total_usd, net_worth_balances(amount, accounts(name, type, currency, is_liability))"
    )
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .limit(2);
  if (eSnap) throw eSnap;

  const last = snaps?.[0] as Record<string, unknown> | undefined;
  if (!last) return { ok: false, reason: "No hay fotos de patrimonio para el correo." };
  const prev = snaps?.[1] as Record<string, unknown> | undefined;

  const rate = Number(last.exchange_rate) || 0;
  const balances: BalRow[] = ((last.net_worth_balances as Record<string, unknown>[]) ?? []).map((b) => ({
    amount: Number(b.amount),
    account: b.accounts as BalRow["account"],
  }));
  const bob = (b: BalRow) => (b.account.currency === "BOB" ? b.amount : b.amount * rate);

  const disponibilidad = round2(
    balances.filter((b) => !b.account.is_liability && TIPOS_LIQUIDOS.has(b.account.type)).reduce((s, b) => s + bob(b), 0)
  );
  const porCobrar = saldoCuenta(balances, (a) => a.type === "por_cobrar", bob);
  const activos = saldoCuenta(balances, (a) => a.name === "Activos", bob);

  const totalBob = Number(last.total_bob) || 0;
  const totalUsd = last.total_usd != null ? Number(last.total_usd) : rate ? round2(totalBob / rate) : 0;
  const prevTotal = prev?.total_bob != null ? Number(prev.total_bob) : null;
  const deltaBob = prevTotal != null ? round2(totalBob - prevTotal) : null;
  const deltaPct = prevTotal && prevTotal > 0 && deltaBob != null ? deltaBob / prevTotal : null;

  // Detalle DPF (tolerante a migraciones no aplicadas).
  let dpfData: PatrimonioEmailData["dpf"] = null;
  let vencenHoy: DpfAlertaItem[] = [];
  try {
    const deposits = await getDpfs(admin);
    const r = resumenDpf(deposits, hoy);
    const prox = r.proximo;
    dpfData = {
      capital: r.montoEnDpf,
      gananciaLiquida: r.gananciaLiquida,
      proxima: prox
        ? {
            titulo: prox.pizarra || prox.id_dpf_externo || "DPF",
            fecha: prox.end_date,
            monto: prox.montoAlVencimiento,
            dias: prox.diasRestantes,
          }
        : null,
    };
    vencenHoy = r.dpfs
      .filter((d) => d.status === "activo" && d.end_date === hoy)
      .map((d) => ({
        titulo: d.pizarra || d.id_dpf_externo || "DPF",
        fecha: d.end_date,
        capital: d.principal,
        montoAlVencimiento: d.montoAlVencimiento,
        ganancia: d.interesLiquido,
        tasa: d.annual_rate,
      }));
  } catch {
    dpfData = null;
  }

  // 1) Correo de patrimonio.
  const data: PatrimonioEmailData = {
    fecha: last.snapshot_date as string,
    totalBob,
    totalUsd,
    tc: rate,
    deltaBob,
    deltaPct,
    disponibilidad,
    porCobrar,
    activos,
    dpf: dpfData,
  };
  const patri = htmlPatrimonioDiario(data);
  await enviarCorreo({ subject: patri.subject, html: patri.html, text: patri.text });

  // 2) Correo de alerta de DPF (solo si vence alguno hoy).
  let alertaEnviada = false;
  if (vencenHoy.length > 0) {
    const alerta = htmlDpfAlerta(vencenHoy, hoy);
    await enviarCorreo({ subject: alerta.subject, html: alerta.html, text: alerta.text });
    alertaEnviada = true;
  }

  return {
    ok: true,
    patrimonio_enviado: true,
    alerta_enviada: alertaEnviada,
    dpf_vencen_hoy: vencenHoy.length,
  };
}

function saldoCuenta(
  balances: BalRow[],
  match: (a: BalRow["account"]) => boolean,
  bob: (b: BalRow) => number
): number | null {
  const b = balances.find((x) => match(x.account));
  return b ? round2(bob(b)) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
