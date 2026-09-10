import type { SupabaseClient } from "@supabase/supabase-js";
import { crearTransaccion } from "@/lib/mutations/gastos";
import { crearDeuda } from "@/lib/mutations/deudas";
import { getTcConfig, getUltimoTc } from "@/lib/queries/tc";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { enviarCorreo } from "@/lib/mailer";
import { htmlAlertaVoz } from "@/lib/emails/plantillas";
import { htmlReciboVozCompleto, type IngresoRecibo } from "@/lib/emails/recibo-voz";
import { interpretarAudio } from "@/lib/voz/gemini";

async function enviarConLimite(opts: { subject: string; html: string; text?: string; to?: string | null }): Promise<boolean> {
  const to = opts.to?.trim();
  if (!to) return false;
  const correo = { subject: opts.subject, html: opts.html, text: opts.text, to };
  try {
    await Promise.race([
      enviarCorreo(correo),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout correo")), 12_000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

function ahoraBolivia(): string {
  return new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

interface Catalogos {
  cuentas: { id: string; name: string; type: string; currency: string }[];
  cuentaNombre: Map<string, string>;
  categoriasGasto: { id: string; name: string }[];
  categoriasIngreso: { id: string; name: string }[];
  categoriaNombre: Map<string, string>;
}

async function cargarCatalogos(admin: SupabaseClient, userId: string): Promise<Catalogos> {
  const [cuentasRes, categoriasRes] = await Promise.all([
    admin.from("accounts").select("id, name, type, currency").eq("user_id", userId).eq("active", true),
    admin.from("categories").select("id, name, kind").eq("user_id", userId).in("kind", ["gasto", "ingreso"]).eq("active", true),
  ]);
  if (cuentasRes.error) throw cuentasRes.error;
  if (categoriasRes.error) throw categoriasRes.error;
  const cuentas = (cuentasRes.data ?? []) as Catalogos["cuentas"];
  const categorias = (categoriasRes.data ?? []) as Array<{ id: string; name: string; kind: string }>;
  const categoriasGasto = categorias.filter((c) => c.kind === "gasto").map(({ id, name }) => ({ id, name }));
  const categoriasIngreso = categorias.filter((c) => c.kind === "ingreso").map(({ id, name }) => ({ id, name }));
  return { cuentas, cuentaNombre: new Map(cuentas.map((c) => [c.id, c.name])), categoriasGasto, categoriasIngreso, categoriaNombre: new Map(categorias.map((c) => [c.id, c.name])) };
}

async function obtenerCorreoDestino(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: setting, error } = await admin.from("app_settings").select("value").eq("user_id", userId).eq("key", "email_destino").maybeSingle();
  if (!error && setting?.value) return String(setting.value).trim() || null;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email?.trim() || null;
}

interface Resultado {
  status: "completado" | "parcial" | "incompleto" | "error";
  nGastos: number;
  nIngresos: number;
  nDeudas: number;
  resumen: string;
  transcripcion: string | null;
  detalle: unknown;
  error: string | null;
  correoOk: boolean;
}

export async function procesarSolicitudVoz(admin: SupabaseClient, opts: { userId: string; audioBase64: string; mimeType: string }): Promise<Resultado> {
  const { userId } = opts;
  const fechaHora = ahoraBolivia();
  const correoDestino = await obtenerCorreoDestino(admin, userId).catch(() => null);

  try {
    // SELECT justo antes del prompt: Gemini solo recibe los catálogos activos del usuario.
    const cat = await cargarCatalogos(admin, userId);
    const parsed = await interpretarAudio({ audioBase64: opts.audioBase64, mimeType: opts.mimeType, hoy: fechaBoliviaHoy(), cuentas: cat.cuentas, categoriasGasto: cat.categoriasGasto, categoriasIngreso: cat.categoriasIngreso });

    let rateExt: number | null = null;
    if ([...parsed.gastos, ...parsed.ingresos].some((m) => m.moneda !== "BOB")) {
      try {
        const cfg = await getTcConfig(admin, userId);
        const row = await getUltimoTc(admin, fechaBoliviaHoy(), cfg.cod_moneda, userId);
        rateExt = row?.valor ?? null;
      } catch { rateExt = null; }
    }

    const registradosGasto: Array<{ descripcion: string; monto: number; moneda: string; cuenta: string | null; categoria: string | null }> = [];
    const registradosIngreso: IngresoRecibo[] = [];
    const registradosDeuda: Array<{ quien: string | null; monto: number; motivo: string | null }> = [];
    const incompletos: string[] = [];

    for (const g of parsed.gastos) {
      const etiqueta = g.descripcion || "gasto";
      if (g.monto == null || !(g.monto > 0)) { incompletos.push(`Gasto “${etiqueta}”: falta el monto.`); continue; }
      if (g.moneda !== "BOB" && !(rateExt && rateExt > 0)) { incompletos.push(`Gasto “${etiqueta}”: falta el tipo de cambio para ${g.moneda}.`); continue; }
      await crearTransaccion(admin, { occurred_at: new Date().toISOString(), type: "gasto", amount: g.monto, currency: g.moneda, exchange_rate: g.moneda === "BOB" ? null : rateExt, account_id: g.cuenta_id, category_id: g.categoria_id, description: g.descripcion || null, source: "voz" }, userId);
      registradosGasto.push({ descripcion: g.descripcion || "Gasto", monto: g.monto, moneda: g.moneda, cuenta: g.cuenta_id ? cat.cuentaNombre.get(g.cuenta_id) ?? null : null, categoria: g.categoria_id ? cat.categoriaNombre.get(g.categoria_id) ?? null : null });
    }

    for (const i of parsed.ingresos) {
      const etiqueta = i.descripcion || "ingreso";
      if (i.monto == null || !(i.monto > 0)) { incompletos.push(`Ingreso “${etiqueta}”: falta el monto.`); continue; }
      if (i.moneda !== "BOB" && !(rateExt && rateExt > 0)) { incompletos.push(`Ingreso “${etiqueta}”: falta el tipo de cambio para ${i.moneda}.`); continue; }
      await crearTransaccion(admin, { occurred_at: new Date().toISOString(), type: "ingreso", amount: i.monto, currency: i.moneda, exchange_rate: i.moneda === "BOB" ? null : rateExt, account_id: i.cuenta_id, category_id: i.categoria_id, description: i.descripcion || null, source: "voz" }, userId);
      registradosIngreso.push({ descripcion: i.descripcion || "Ingreso", monto: i.monto, moneda: i.moneda, cuenta: i.cuenta_id ? cat.cuentaNombre.get(i.cuenta_id) ?? null : null, categoria: i.categoria_id ? cat.categoriaNombre.get(i.categoria_id) ?? null : null });
    }

    for (const d of parsed.deudas) {
      const quien = d.quien || "alguien";
      if (d.monto == null || !(d.monto > 0)) { incompletos.push(`Deuda de ${quien}: falta el monto.`); continue; }
      await crearDeuda(admin, { debt_date: fechaBoliviaHoy(), amount: d.monto, paid_amount: 0, reason: d.motivo, counterparty: d.quien, status: "pendiente" }, userId);
      registradosDeuda.push({ quien: d.quien, monto: d.monto, motivo: d.motivo });
    }

    const nGastos = registradosGasto.length, nIngresos = registradosIngreso.length, nDeudas = registradosDeuda.length, totalReg = nGastos + nIngresos + nDeudas;
    const status: Resultado["status"] = totalReg > 0 ? incompletos.length ? "parcial" : "completado" : "incompleto";
    let correoOk = false;
    if (totalReg > 0) correoOk = await enviarConLimite({ ...htmlReciboVozCompleto({ fechaHora, transcripcion: parsed.transcripcion, gastos: registradosGasto, ingresos: registradosIngreso, deudas: registradosDeuda, incompletos }), to: correoDestino });
    else correoOk = await enviarConLimite({ ...htmlAlertaVoz({ fechaHora, transcripcion: parsed.transcripcion, motivos: incompletos.length ? incompletos : ["No se detectó ningún gasto, ingreso ni deuda en el audio."] }), to: correoDestino });

    const resumenPartes: string[] = [];
    if (nGastos) resumenPartes.push(`${nGastos} gasto${nGastos > 1 ? "s" : ""}`);
    if (nIngresos) resumenPartes.push(`${nIngresos} ingreso${nIngresos > 1 ? "s" : ""}`);
    if (nDeudas) resumenPartes.push(`${nDeudas} deuda${nDeudas > 1 ? "s" : ""}`);
    if (incompletos.length) resumenPartes.push(`${incompletos.length} sin registrar`);
    return { status, nGastos, nIngresos, nDeudas, resumen: resumenPartes.join(", ") || "Sin datos", transcripcion: parsed.transcripcion, detalle: { gastos: registradosGasto, ingresos: registradosIngreso, deudas: registradosDeuda, incompletos }, error: incompletos.length ? incompletos.join(" ") : null, correoOk };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al procesar el audio.";
    const correoOk = await enviarConLimite({ ...htmlAlertaVoz({ fechaHora, transcripcion: null, motivos: [`Ocurrió un error al procesar el audio: ${msg}`] }), to: correoDestino });
    return { status: "error", nGastos: 0, nIngresos: 0, nDeudas: 0, resumen: "Error", transcripcion: null, detalle: null, error: msg, correoOk };
  }
}
