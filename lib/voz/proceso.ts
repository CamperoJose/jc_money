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
  try {
    await Promise.race([enviarCorreo({ subject: opts.subject, html: opts.html, text: opts.text, to }), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout correo")), 12_000))]);
    return true;
  } catch { return false; }
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
  return {
    cuentas,
    cuentaNombre: new Map(cuentas.map((c) => [c.id, c.name])),
    categoriasGasto: categorias.filter((c) => c.kind === "gasto").map(({ id, name }) => ({ id, name })),
    categoriasIngreso: categorias.filter((c) => c.kind === "ingreso").map(({ id, name }) => ({ id, name })),
    categoriaNombre: new Map(categorias.map((c) => [c.id, c.name])),
  };
}

async function obtenerCorreoDestino(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: setting, error } = await admin.from("app_settings").select("value").eq("user_id", userId).eq("key", "email_destino").maybeSingle();
  if (!error && setting?.value) return String(setting.value).trim() || null;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email?.trim() || null;
}

interface Resultado {
  status: "completado" | "parcial" | "incompleto" | "error";
  nGastos: number; nIngresos: number; nDeudas: number;
  resumen: string; transcripcion: string | null; detalle: unknown; error: string | null; correoOk: boolean;
}

const UNIDADES: Record<string, number> = { cero:0, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9 };
const ESPECIALES: Record<string, number> = { diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19, veinte:20, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29 };
const DECENAS: Record<string, number> = { treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90 };
const CENTENAS: Record<string, number> = { cien:100, ciento:100, doscientos:200, trescientos:300, cuatrocientos:400, quinientos:500, seiscientos:600, setecientos:700, ochocientos:800, novecientos:900 };

function normalizarTexto(texto: string): string { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }

function numeroEnPalabras(tokens: string[]): number | null {
  let total = 0, actual = 0, encontrado = false;
  for (const token of tokens) {
    if (token === "y") continue;
    if (UNIDADES[token] !== undefined) { actual += UNIDADES[token]; encontrado = true; continue; }
    if (ESPECIALES[token] !== undefined) { actual += ESPECIALES[token]; encontrado = true; continue; }
    if (DECENAS[token] !== undefined) { actual += DECENAS[token]; encontrado = true; continue; }
    if (CENTENAS[token] !== undefined) { actual += CENTENAS[token]; encontrado = true; continue; }
    if (token === "mil") { total += (actual || 1) * 1000; actual = 0; encontrado = true; continue; }
    if (token === "millon" || token === "millones") { total += (actual || 1) * 1000000; actual = 0; encontrado = true; continue; }
    if (encontrado) break;
  }
  return encontrado ? total + actual : null;
}

function extraerMontoExplicito(texto: string): number | null {
  const normal = normalizarTexto(texto);
  const digitos = normal.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?:\s|$)/);
  if (digitos) {
    const n = Number(digitos[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  const tokens = normal.split(" ");
  for (let i = 0; i < tokens.length; i++) {
    const valor = numeroEnPalabras(tokens.slice(i, Math.min(tokens.length, i + 8)));
    if (valor != null && valor > 0) return Math.round(valor * 100) / 100;
  }
  return null;
}

function contieneTipo(texto: string, tipo: "gasto" | "ingreso" | "deuda"): boolean {
  const n = normalizarTexto(texto);
  if (tipo === "gasto") return /\b(gasto|gastos|gaste|gastar|pague|pagar|pagado|compre|comprar|compra|costo|coste|consumi|consumo|adquiri|adquirir|salio|salida)\b/.test(n);
  if (tipo === "ingreso") return /\b(ingreso|ingrese|recibi|recibir|pagaron|cobre|cobrar|depositaron|deposito|sueldo|salario|me dieron)\b/.test(n);
  return /\b(preste|prestar|fie|fio|debe|deben|deuda|debiendo|cobrar|prestado|me debe)\b/.test(n);
}

function encontrarCuenta(transcripcion: string, cuentas: Catalogos["cuentas"]): string | null {
  const n = normalizarTexto(transcripcion);
  let mejor: { id: string; score: number } | null = null;
  for (const c of cuentas) {
    const nombre = normalizarTexto(c.name);
    if (!nombre) continue;
    if (n.includes(nombre)) return c.id;
    const palabras = nombre.split(" ").filter((p) => p.length >= 3);
    const score = palabras.filter((p) => n.includes(p)).length;
    if (score > 0 && (!mejor || score > mejor.score)) mejor = { id: c.id, score };
  }
  return mejor?.id ?? null;
}

function descripcionGasto(transcripcion: string): string {
  const original = transcripcion.replace(/\s+/g, " ").trim();
  const por = original.match(/\bpor\s+(.+)$/i);
  return por?.[1]?.trim() || original;
}

function monedaValida(m: unknown, texto: string): "BOB" | "USD" | "USDT" {
  if (m === "USD" && /d[oó]lar|usd/i.test(texto)) return "USD";
  if (m === "USDT" && /usdt|tether/i.test(texto)) return "USDT";
  return "BOB";
}

/** Recupera comandos semánticamente claros aunque Gemini haya devuelto arrays vacíos o haya fallado al mapear campos por una redacción imperfecta. */
function recuperarDesdeTranscripcion(parsed: Awaited<ReturnType<typeof interpretarAudio>>, cat: Catalogos): Awaited<ReturnType<typeof interpretarAudio>> {
  const t = parsed.transcripcion;
  if (!t) return parsed;
  const monto = extraerMontoExplicito(t);
  if (monto == null) return parsed;
  const resultado = { ...parsed, gastos: [...parsed.gastos], ingresos: [...parsed.ingresos], deudas: [...parsed.deudas] };
  if (contieneTipo(t, "gasto") && resultado.gastos.length === 0) resultado.gastos.push({ descripcion: descripcionGasto(t), monto, moneda: "BOB", cuenta_id: encontrarCuenta(t, cat.cuentas), categoria_id: null });
  if (contieneTipo(t, "ingreso") && resultado.ingresos.length === 0) resultado.ingresos.push({ descripcion: t.trim(), monto, moneda: "BOB", cuenta_id: encontrarCuenta(t, cat.cuentas), categoria_id: null });
  if (contieneTipo(t, "deuda") && resultado.deudas.length === 0) resultado.deudas.push({ quien: null, monto, moneda: "BOB", motivo: t.trim() });
  return resultado;
}

export async function procesarSolicitudVoz(admin: SupabaseClient, opts: { userId: string; audioBase64: string; mimeType: string }): Promise<Resultado> {
  const { userId } = opts;
  const fechaHora = ahoraBolivia();
  const correoDestino = await obtenerCorreoDestino(admin, userId).catch(() => null);
  try {
    const cat = await cargarCatalogos(admin, userId);
    let parsed = await interpretarAudio({ audioBase64: opts.audioBase64, mimeType: opts.mimeType, hoy: fechaBoliviaHoy(), cuentas: cat.cuentas, categoriasGasto: cat.categoriasGasto, categoriasIngreso: cat.categoriasIngreso });
    parsed = recuperarDesdeTranscripcion(parsed, cat);
    let rateExt: number | null = null;
    if ([...parsed.gastos, ...parsed.ingresos].some((m) => m.moneda !== "BOB")) {
      try { const cfg = await getTcConfig(admin, userId); const row = await getUltimoTc(admin, fechaBoliviaHoy(), cfg.cod_moneda, userId); rateExt = row?.valor ?? null; } catch { rateExt = null; }
    }
    const registradosGasto: Array<{ descripcion: string; monto: number; moneda: string; cuenta: string | null; categoria: string | null }> = [];
    const registradosIngreso: IngresoRecibo[] = [];
    const registradosDeuda: Array<{ quien: string | null; monto: number; motivo: string | null }> = [];
    const incompletos: string[] = [];
    for (const g of parsed.gastos) {
      const etiqueta = g.descripcion || "gasto";
      if (g.monto == null || !(g.monto > 0)) { incompletos.push(`Gasto “${etiqueta}”: falta el monto.`); continue; }
      const currency = monedaValida(g.moneda, parsed.transcripcion ?? "");
      if (currency !== "BOB" && !(rateExt && rateExt > 0)) { incompletos.push(`Gasto “${etiqueta}”: falta el tipo de cambio para ${currency}.`); continue; }
      await crearTransaccion(admin, { occurred_at: new Date().toISOString(), type: "gasto", amount: g.monto, currency, exchange_rate: currency === "BOB" ? null : rateExt, account_id: g.cuenta_id, category_id: g.categoria_id, description: g.descripcion || null, source: "voz" }, userId);
      registradosGasto.push({ descripcion: g.descripcion || "Gasto", monto: g.monto, moneda: currency, cuenta: g.cuenta_id ? cat.cuentaNombre.get(g.cuenta_id) ?? null : null, categoria: g.categoria_id ? cat.categoriaNombre.get(g.categoria_id) ?? null : null });
    }
    for (const i of parsed.ingresos) {
      const etiqueta = i.descripcion || "ingreso";
      if (i.monto == null || !(i.monto > 0)) { incompletos.push(`Ingreso “${etiqueta}”: falta el monto.`); continue; }
      const currency = monedaValida(i.moneda, parsed.transcripcion ?? "");
      if (currency !== "BOB" && !(rateExt && rateExt > 0)) { incompletos.push(`Ingreso “${etiqueta}”: falta el tipo de cambio para ${currency}.`); continue; }
      await crearTransaccion(admin, { occurred_at: new Date().toISOString(), type: "ingreso", amount: i.monto, currency, exchange_rate: currency === "BOB" ? null : rateExt, account_id: i.cuenta_id, category_id: i.categoria_id, description: i.descripcion || null, source: "voz" }, userId);
      registradosIngreso.push({ descripcion: i.descripcion || "Ingreso", monto: i.monto, moneda: currency, cuenta: i.cuenta_id ? cat.cuentaNombre.get(i.cuenta_id) ?? null : null, categoria: i.categoria_id ? cat.categoriaNombre.get(i.categoria_id) ?? null : null });
    }
    for (const d of parsed.deudas) {
      const quien = d.quien || "alguien";
      if (d.monto == null || !(d.monto > 0)) { incompletos.push(`Deuda de ${quien}: falta el monto.`); continue; }
      await crearDeuda(admin, { debt_date: fechaBoliviaHoy(), amount: d.monto, paid_amount: 0, reason: d.motivo, counterparty: d.quien, status: "pendiente" }, userId);
      registradosDeuda.push({ quien: d.quien, monto: d.monto, motivo: d.motivo });
    }
    const nGastos = registradosGasto.length, nIngresos = registradosIngreso.length, nDeudas = registradosDeuda.length, totalReg = nGastos + nIngresos + nDeudas;
    const status: Resultado["status"] = totalReg > 0 ? incompletos.length ? "parcial" : "completado" : "incompleto";
    const correoOk = totalReg > 0
      ? await enviarConLimite({ ...htmlReciboVozCompleto({ fechaHora, transcripcion: parsed.transcripcion, gastos: registradosGasto, ingresos: registradosIngreso, deudas: registradosDeuda, incompletos }), to: correoDestino })
      : await enviarConLimite({ ...htmlAlertaVoz({ fechaHora, transcripcion: parsed.transcripcion, motivos: incompletos.length ? incompletos : ["No se detectó ningún gasto, ingreso ni deuda en el audio."] }), to: correoDestino });
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
