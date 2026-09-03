import type { SupabaseClient } from "@supabase/supabase-js";
import { crearTransaccion } from "@/lib/mutations/gastos";
import { crearDeuda } from "@/lib/mutations/deudas";
import { getTcConfig, getUltimoTc } from "@/lib/queries/tc";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo } from "@/lib/mailer";
import { htmlReciboVoz, htmlAlertaVoz, type GastoRecibo, type DeudaRecibo } from "@/lib/emails/plantillas";
import { interpretarAudio } from "@/lib/voz/gemini";

/** Fecha y hora legible en zona Bolivia. */
function ahoraBolivia(): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

interface Catalogos {
  cuentas: { id: string; name: string; type: string; currency: string }[];
  cuentaNombre: Map<string, string>;
  categorias: { id: string; name: string }[];
  categoriaNombre: Map<string, string>;
}

async function cargarCatalogos(admin: SupabaseClient, userId: string): Promise<Catalogos> {
  const [{ data: cRaw }, { data: catRaw }] = await Promise.all([
    admin.from("accounts").select("id, name, type, currency").eq("user_id", userId).eq("active", true),
    admin.from("categories").select("id, name").eq("user_id", userId).eq("kind", "gasto").eq("active", true),
  ]);
  const cuentas = (cRaw ?? []).map((c) => c as { id: string; name: string; type: string; currency: string });
  const categorias = (catRaw ?? []).map((c) => c as { id: string; name: string });
  return {
    cuentas,
    cuentaNombre: new Map(cuentas.map((c) => [c.id, c.name])),
    categorias,
    categoriaNombre: new Map(categorias.map((c) => [c.id, c.name])),
  };
}

interface Resultado {
  status: "completado" | "parcial" | "incompleto" | "error";
  nGastos: number;
  nDeudas: number;
  resumen: string;
  transcripcion: string | null;
  detalle: unknown;
  error: string | null;
  correoOk: boolean;
}

/**
 * Procesa una solicitud de voz de forma asíncrona: interpreta el audio con
 * Gemini, registra los gastos/deudas completos, envía un correo (recibo si se
 * registró algo, alerta si faltó un dato crítico) y devuelve el resultado para
 * actualizar la fila de auditoría `ai_requests`.
 */
export async function procesarSolicitudVoz(
  admin: SupabaseClient,
  opts: { userId: string; audioBase64: string; mimeType: string }
): Promise<Resultado> {
  const { userId } = opts;
  const fechaHora = ahoraBolivia();

  try {
    const cat = await cargarCatalogos(admin, userId);
    const parsed = await interpretarAudio({
      audioBase64: opts.audioBase64,
      mimeType: opts.mimeType,
      hoy: fechaBoliviaHoy(),
      cuentas: cat.cuentas,
      categorias: cat.categorias,
    });

    // T/C para gastos en moneda extranjera (aprox., del último registro).
    let rateExt: number | null = null;
    if (parsed.gastos.some((g) => g.moneda !== "BOB")) {
      try {
        const cfg = await getTcConfig(admin);
        const row = await getUltimoTc(admin, fechaBoliviaHoy(), cfg.cod_moneda);
        rateExt = row?.valor ?? null;
      } catch {
        rateExt = null;
      }
    }

    const registradosGasto: GastoRecibo[] = [];
    const registradosDeuda: DeudaRecibo[] = [];
    const incompletos: string[] = [];

    // Gastos
    for (const g of parsed.gastos) {
      const etiqueta = g.descripcion || "gasto";
      if (g.monto == null || !(g.monto > 0)) {
        incompletos.push(`Gasto “${etiqueta}”: falta el monto.`);
        continue;
      }
      if (g.moneda !== "BOB" && !(rateExt && rateExt > 0)) {
        incompletos.push(`Gasto “${etiqueta}”: falta el tipo de cambio para ${g.moneda}.`);
        continue;
      }
      await crearTransaccion(
        admin,
        {
          occurred_at: new Date().toISOString(),
          type: "gasto",
          amount: g.monto,
          currency: g.moneda,
          exchange_rate: g.moneda === "BOB" ? null : rateExt,
          account_id: g.cuenta_id,
          category_id: g.categoria_id,
          description: g.descripcion || null,
          source: "voz",
        },
        userId
      );
      registradosGasto.push({
        descripcion: g.descripcion || "Gasto",
        monto: g.monto,
        moneda: g.moneda,
        cuenta: g.cuenta_id ? cat.cuentaNombre.get(g.cuenta_id) ?? null : null,
        categoria: g.categoria_id ? cat.categoriaNombre.get(g.categoria_id) ?? null : null,
      });
    }

    // Deudas
    for (const d of parsed.deudas) {
      const quien = d.quien || "alguien";
      if (d.monto == null || !(d.monto > 0)) {
        incompletos.push(`Deuda de ${quien}: falta el monto.`);
        continue;
      }
      await crearDeuda(
        admin,
        {
          debt_date: fechaBoliviaHoy(),
          amount: d.monto,
          paid_amount: 0,
          reason: d.motivo,
          counterparty: d.quien,
          status: "pendiente",
        },
        userId
      );
      registradosDeuda.push({ quien: d.quien, monto: d.monto, motivo: d.motivo });
    }

    const nGastos = registradosGasto.length;
    const nDeudas = registradosDeuda.length;
    const totalReg = nGastos + nDeudas;

    // Estado
    let status: Resultado["status"];
    if (totalReg > 0 && incompletos.length === 0) status = "completado";
    else if (totalReg > 0) status = "parcial";
    else status = "incompleto";

    // Correo
    let correoOk = false;
    try {
      if (totalReg > 0) {
        const { subject, html, text } = htmlReciboVoz({
          fechaHora,
          transcripcion: parsed.transcripcion,
          gastos: registradosGasto,
          deudas: registradosDeuda,
          incompletos,
        });
        await enviarCorreo({ subject, html, text });
      } else {
        const { subject, html, text } = htmlAlertaVoz({
          fechaHora,
          transcripcion: parsed.transcripcion,
          motivos: incompletos.length ? incompletos : ["No se detectó ningún gasto ni deuda en el audio."],
        });
        await enviarCorreo({ subject, html, text });
      }
      correoOk = true;
    } catch {
      correoOk = false;
    }

    const resumenPartes: string[] = [];
    if (nGastos) resumenPartes.push(`${nGastos} gasto${nGastos > 1 ? "s" : ""}`);
    if (nDeudas) resumenPartes.push(`${nDeudas} deuda${nDeudas > 1 ? "s" : ""}`);
    if (incompletos.length) resumenPartes.push(`${incompletos.length} sin registrar`);

    return {
      status,
      nGastos,
      nDeudas,
      resumen: resumenPartes.join(", ") || "Sin datos",
      transcripcion: parsed.transcripcion,
      detalle: { gastos: registradosGasto, deudas: registradosDeuda, incompletos },
      error: incompletos.length ? incompletos.join(" ") : null,
      correoOk,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al procesar el audio.";
    // Intenta avisar por correo del fallo.
    let correoOk = false;
    try {
      const { subject, html, text } = htmlAlertaVoz({
        fechaHora,
        transcripcion: null,
        motivos: [`Ocurrió un error al procesar el audio: ${msg}`],
      });
      await enviarCorreo({ subject, html, text });
      correoOk = true;
    } catch {
      correoOk = false;
    }
    return {
      status: "error",
      nGastos: 0,
      nDeudas: 0,
      resumen: "Error",
      transcripcion: null,
      detalle: null,
      error: msg,
      correoOk,
    };
  }
}
