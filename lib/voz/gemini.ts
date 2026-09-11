import { obtenerAccessToken } from "@/lib/gcp/token";
import { cargarServiceAccount } from "@/lib/gcp/credenciales";
import type { Currency } from "@/lib/types";
import type { DeudaVoz, GastoVoz, IngresoVoz, ResultadoVoz } from "@/lib/voz/tipos";

export interface CuentaCatalogo { id: string; name: string; type: string; currency: string; }
export interface CategoriaCatalogo { id: string; name: string; }

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
const LOCATION = process.env.GCP_LOCATION?.trim() || "global";
const REINTENTOS = 2;
const ESPERAS_MS = [1500];
const TIMEOUT_MS = 25_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function hostVertex(location: string): string { return location === "global" ? "https://aiplatform.googleapis.com" : `https://${location}-aiplatform.googleapis.com`; }

function construirPrompt(cuentas: CuentaCatalogo[], categoriasGasto: CategoriaCatalogo[], categoriasIngreso: CategoriaCatalogo[], hoy: string): string {
  const listaCuentas = cuentas.map((c) => `- id="${c.id}" | nombre="${c.name}" | tipo=${c.type} | moneda=${c.currency}`).join("\n");
  const listaCategoriasGasto = categoriasGasto.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");
  const listaCategoriasIngreso = categoriasIngreso.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");
  return `Eres un parser financiero para comandos de voz en español boliviano.

PRIMERA REGLA — SEGURIDAD DEL AUDIO:
Primero inspecciona el AUDIO adjunto y decide si contiene habla humana inteligible.
- Si el audio está vacío, contiene solo silencio, ruido, está incompleto, es inaudible o NO puedes identificar con claridad habla humana, responde con audio_con_habla=false, transcripcion="" y TODOS los arrays vacíos.
- NUNCA inventes, completes ni supongas palabras, números, nombres o movimientos financieros.
- Un audio con silencio no es una orden financiera.
- Solo considera información realmente pronunciada en el audio.

Fecha de hoy: ${hoy}.

La persona puede dictar UNO O VARIOS movimientos financieros en el MISMO audio.
Debes detectar y registrar CADA movimiento independiente que haya sido pronunciado. NUNCA resumas, agrupes ni conviertas varios movimientos en uno solo.
Si una frase financiera es suficientemente comprensible, intenta interpretarla aunque la redacción sea informal, incompleta o tenga errores gramaticales.
Si no dice explícitamente que es ingreso o deuda, un movimiento monetario debe considerarse GASTO como primera opción. Solo clasifícalo como INGRESO o DEUDA cuando exista evidencia explícita de ello.

REGLA CRÍTICA — MÚLTIPLES MOVIMIENTOS:
- Un audio puede contener 2, 3 o más gastos.
- Cada compra, pago o gasto independiente debe convertirse en un objeto separado dentro de gastos[].
- Si aparecen varios importes asociados a diferentes compras, crea un gasto por cada importe.
- Ejemplo: "gasté 20 en pan y 35 en almuerzo" => DOS gastos: pan=20 y almuerzo=35.
- Ejemplo: "compré pan 10, leche 8 y huevos 15" => TRES gastos: pan=10, leche=8 y huevos=15.
- Ejemplo: "pagué 50 de Netflix y 30 de internet" => DOS gastos independientes.
- NO sumes importes. NO agrupes productos. NO conviertas una lista de compras en un único gasto.
- Conserva cada descripción y su importe correspondiente.
- Mantén los movimientos en el orden en que fueron mencionados cuando sea posible.
- También puedes devolver varios ingresos y/o deudas si aparecen varios movimientos de esos tipos.
- Un solo audio puede mezclar gastos, ingresos y deudas; clasifica cada movimiento por separado.

REGLA CRÍTICA — DECIMALES Y CENTAVOS:
Los montos pueden tener bolivianos y centavos. NUNCA redondees un monto que incluya centavos.
- "3 punto 50" => 3.50
- "3 punto cinco" => 3.50
- "3 coma 50" => 3.50
- "3 coma cinco" => 3.50
- "3 con 50 centavos" => 3.50
- "3 bolivianos con 50 centavos" => 3.50
- "3 50" o "3 con 50" cuando se está dictando un precio => 3.50, NO 350.
- "10 punto 25" => 10.25
- "10 coma 25" => 10.25
- Si se pronuncian explícitamente centavos, los dos dígitos siguientes representan centavos, incluso si son "05".
- Diferencia entre "350" y "3 50": "350" es trescientos cincuenta; "3 50" en contexto de precio es tres bolivianos con cincuenta centavos.
- Conserva siempre hasta 2 decimales en monto cuando corresponda. No conviertas 3.50 en 3.
- El campo monto debe ser un NÚMERO JSON, por ejemplo 3.5 o 3.50, nunca una cadena.

Distingue:
- GASTO: la persona pagó/compró/gastó algo. Ej: "gasté", "pagué", "compré", "me costó".
- INGRESO: la persona recibió dinero. Ej: "recibí", "me pagaron", "cobré", "me depositaron", "recibí mi sueldo".
- DEUDA (que me deben): la persona prestó dinero o alguien le debe. Ej: "presté", "le fié", "me debe", "quedó debiendo", "por cobrar".

CATEGORIZACIÓN — REGLA OBLIGATORIA:
Las categorías disponibles que aparecen más abajo son el catálogo REAL y cerrado del usuario.
Para cada GASTO, compara semánticamente la descripción, el comercio, producto o servicio mencionado contra TODAS las categorías de gasto disponibles y selecciona la que mejor represente el movimiento.
Para cada INGRESO, compara semánticamente el origen o concepto del dinero contra TODAS las categorías de ingreso disponibles y selecciona la que mejor represente el movimiento.

IMPORTANTE SOBRE CATEGORÍAS:
- Si existe al menos una categoría disponible del tipo correspondiente, intenta seleccionar SIEMPRE la mejor categoría existente.
- NO necesitas encontrar coincidencia literal entre las palabras del audio y el nombre de la categoría.
- Usa significado y contexto.
- No inventes categorías ni IDs.
- Si ninguna categoría es perfecta pero hay categorías disponibles, elige la más cercana semánticamente.
- categoria_id puede ser null ÚNICAMENTE cuando la lista correspondiente de categorías esté vacía o cuando sea imposible determinar el tipo del movimiento.

Para cada GASTO extrae:
- descripcion: qué se compró/pagó, usando únicamente palabras presentes en el audio.
- monto: número explícitamente pronunciado, respetando exactamente los centavos indicados.
- moneda: "BOB" por defecto en Bolivia, "USD" si dice dólares, "USDT" si dice USDT/tether.
- cuenta_id: SOLO un id de CUENTAS cuyo nombre haya sido mencionado claramente. Si no, null.
- categoria_id: ID de la mejor CATEGORÍA DE GASTO disponible.

Para cada INGRESO extrae:
- descripcion: origen del dinero, usando únicamente palabras presentes en el audio.
- monto: número explícitamente pronunciado, respetando exactamente los centavos indicados.
- moneda: "BOB" por defecto en Bolivia, "USD" si dice dólares, "USDT" si dice USDT/tether.
- cuenta_id: SOLO un id de CUENTAS cuyo nombre haya sido mencionado claramente. Si no, null.
- categoria_id: ID de la mejor CATEGORÍA DE INGRESO disponible.

Para cada DEUDA extrae:
- quien: nombre de quien debe, solo si se entiende claramente; si no, null.
- monto: número explícitamente pronunciado, respetando exactamente los centavos indicados.
- moneda: "BOB" por defecto, "USD" si dice dólares, "USDT" si dice USDT/tether.
- motivo: motivo del préstamo solo si fue pronunciado claramente; si no, null.

REGLA DE CUENTAS: las cuentas pertenecen exclusivamente al usuario actual. Solo puedes usar IDs presentes en la lista. No inventes IDs ni elijas una cuenta solo porque parece probable.

CUENTAS disponibles del usuario actual:
${listaCuentas || "(ninguna)"}

CATEGORÍAS DE GASTO disponibles del usuario actual:
${listaCategoriasGasto || "(ninguna)"}

CATEGORÍAS DE INGRESO disponibles del usuario actual:
${listaCategoriasIngreso || "(ninguna)"}

Antes de responder, haz una segunda revisión del audio y verifica:
1. cuántos movimientos financieros independientes fueron pronunciados;
2. que exista un objeto separado para CADA movimiento;
3. que cada importe esté asociado al movimiento correcto;
4. que no hayas combinado dos o más importes en un solo movimiento;
5. que no hayas creado movimientos que no fueron pronunciados;
6. que el tipo sea correcto para cada movimiento;
7. que el monto de cada movimiento esté realmente presente en el audio;
8. que hayas preservado los centavos y no hayas redondeado;
9. que "3 50" en contexto de precio se interprete como 3.50 y no 350;
10. que cuenta_id pertenezca a las cuentas disponibles;
11. que categoria_id pertenezca al catálogo correcto.

Devuelve ÚNICAMENTE JSON válido, sin markdown, con esta forma exacta:
{"audio_con_habla":true,"transcripcion":"","gastos":[{"descripcion":"","monto":0,"moneda":"BOB","cuenta_id":null,"categoria_id":null}],"ingresos":[{"descripcion":"","monto":0,"moneda":"BOB","cuenta_id":null,"categoria_id":null}],"deudas":[{"quien":null,"monto":0,"moneda":"BOB","motivo":null}]}

Si el audio no contiene habla humana clara, devuelve exactamente audio_con_habla=false, transcripcion="" y gastos=[], ingresos=[], deudas=[].
No inventes montos, cuentas, categorías, personas, transcripciones ni movimientos.`;
}

interface VertexResponse { candidates?: { content?: { parts?: { text?: string }[] } }[]; }

async function llamarVertex(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
  const sa = cargarServiceAccount();
  const url = `${hostVertex(LOCATION)}/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const body = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } };
  let ultimoError = "";
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    let res: Response;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const token = await obtenerAccessToken();
      res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : "error de red";
      if (intento < REINTENTOS) { await esperar(ESPERAS_MS[intento - 1]); continue; }
      throw new Error(`No se pudo contactar a Vertex AI: ${ultimoError}`);
    } finally { clearTimeout(timeout); }
    if (res.ok) {
      const data = (await res.json()) as VertexResponse;
      const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!texto.trim()) throw new Error("Vertex AI devolvió una respuesta vacía.");
      return texto;
    }
    const errBody = await res.text().catch(() => "");
    ultimoError = `HTTP ${res.status} ${errBody.slice(0, 300)}`;
    if (res.status === 403) throw new Error("Vertex AI devolvió 403 (permiso denegado). El service account necesita el rol 'Vertex AI User' (roles/aiplatform.user) y la API de Vertex AI habilitada.");
    const reintentable = res.status === 429 || res.status >= 500;
    if (reintentable && intento < REINTENTOS) { await esperar(ESPERAS_MS[intento - 1]); continue; }
    break;
  }
  throw new Error(`Vertex AI falló: ${ultimoError}`);
}

function esperar(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function parsear(textoModelo: string, cuentas: CuentaCatalogo[], categoriasGasto: CategoriaCatalogo[], categoriasIngreso: CategoriaCatalogo[]): ResultadoVoz {
  let limpio = textoModelo.trim();
  if (limpio.startsWith("```")) limpio = limpio.replace(/```[a-z]*\n?/gi, "").trim();
  let obj: unknown;
  try { obj = JSON.parse(limpio); } catch { throw new Error("No se pudo interpretar la respuesta del modelo."); }
  const raw = obj as { audio_con_habla?: unknown; transcripcion?: unknown; gastos?: unknown; ingresos?: unknown; deudas?: unknown };
  const transcripcion = textoONull(raw.transcripcion);
  if (!transcripcion) return { gastos: [], ingresos: [], deudas: [], transcripcion: null };
  const idsCuenta = new Set(cuentas.map((c) => c.id));
  const idsCatGasto = new Set(categoriasGasto.map((c) => c.id));
  const idsCatIngreso = new Set(categoriasIngreso.map((c) => c.id));
  const gastos: GastoVoz[] = Array.isArray(raw.gastos) ? raw.gastos.map((g) => normalizarMovimiento(g, idsCuenta, idsCatGasto, cuentas, transcripcion, "gasto")).filter((g): g is GastoVoz => g !== null) : [];
  const ingresos: IngresoVoz[] = Array.isArray(raw.ingresos) ? raw.ingresos.map((i) => normalizarMovimiento(i, idsCuenta, idsCatIngreso, cuentas, transcripcion, "ingreso")).filter((i): i is IngresoVoz => i !== null) : [];
  const deudas: DeudaVoz[] = Array.isArray(raw.deudas) ? raw.deudas.map((d) => normalizarDeuda(d, transcripcion)).filter((d): d is DeudaVoz => d !== null) : [];
  return { gastos, ingresos, deudas, transcripcion };
}

function moneda(v: unknown): Currency { return v === "USD" || v === "USDT" ? v : "BOB"; }
function numeroONull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".").trim()) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function textoONull(v: unknown): string | null { const t = typeof v === "string" ? v.trim() : ""; return t.length ? t : null; }
const EVIDENCIA: Record<"gasto" | "ingreso" | "deuda", RegExp> = { gasto: /\b(gast|pagu|compr|cost|consum|adquir)\w*/i, ingreso: /\b(recib|pagaron|cobr|deposit|sueldo|salario|gan|ingres)\w*/i, deuda: /\b(prest|fi[eé]|debe|deben|deuda|debiendo|cobrar|prestado)\w*/i };
function tieneEvidenciaDeTipo(transcripcion: string, tipo: "gasto" | "ingreso" | "deuda"): boolean { return EVIDENCIA[tipo].test(transcripcion); }
function quitarAcentos(texto: string): string { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function montoApareceEnTranscripcion(monto: number | null, transcripcion: string): boolean {
  if (monto == null) return false;
  const texto = quitarAcentos(transcripcion.toLowerCase()).replace(/,/g, ".").replace(/\s+/g, " ").trim();
  const entero = Number.isInteger(monto) ? String(monto) : monto.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  if (new RegExp(`(?:^|\\D)${escapeRegExp(entero)}(?:\\D|$)`).test(texto)) return true;

  const parteEntera = Math.floor(monto);
  const centavos = Math.round((monto - parteEntera) * 100);
  if (centavos > 0) {
    const palabrasEntero = numeroEnPalabras(parteEntera);
    const palabrasCentavos = numeroEnPalabras(centavos);
    const patronDecimal = new RegExp(`${escapeRegExp(palabrasEntero ?? "")}\\s+(?:punto|coma|con)(?:\\s+de)?\\s+${escapeRegExp(palabrasCentavos ?? "")}`, "i");
    if (patronDecimal.test(texto)) return true;
    const patronCentavos = new RegExp(`${escapeRegExp(palabrasEntero ?? "")}\\s+(?:bolivianos?|bs)(?:\\s+con)?\\s+${escapeRegExp(palabrasCentavos ?? "")}\\s+centavos?`, "i");
    if (patronCentavos.test(texto)) return true;
  }

  if (Number.isInteger(monto)) {
    const palabras = numeroEnPalabras(monto);
    if (palabras && texto.includes(quitarAcentos(palabras))) return true;
  }
  return false;
}

function monedaApareceEnTranscripcion(moneda: Currency, transcripcion: string): boolean { if (moneda === "BOB") return true; if (moneda === "USD") return /d[oó]lar|usd|d[oó]lares/i.test(transcripcion); return /usdt|tether/i.test(transcripcion); }
function numeroEnPalabras(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999999) return null;
  if (n === 0) return "cero";
  const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const especiales: Record<number, string> = { 10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince", 16: "dieciseis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte", 21: "veintiuno", 22: "veintidos", 23: "veintitres", 24: "veinticuatro", 25: "veinticinco", 26: "veintiseis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve" };
  const decenas = ["", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const hasta999 = (x: number): string => { if (x < 10) return unidades[x]; if (especiales[x]) return especiales[x]; if (x < 100) return decenas[Math.floor(x / 10)] + (x % 10 ? ` y ${unidades[x % 10]}` : ""); if (x === 100) return "cien"; return centenas[Math.floor(x / 100)] + (x % 100 ? ` ${hasta999(x % 100)}` : ""); };
  if (n < 1000) return hasta999(n);
  const miles = Math.floor(n / 1000), resto = n % 1000;
  return `${miles === 1 ? "mil" : `${hasta999(miles)} mil`}${resto ? ` ${hasta999(resto)}` : ""}`;
}

function normalizarMovimiento(value: unknown, idsCuenta: Set<string>, idsCategoria: Set<string>, cuentas: CuentaCatalogo[], transcripcion: string, tipo: "gasto" | "ingreso"): GastoVoz | IngresoVoz | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const descripcion = textoONull(r.descripcion) ?? "";
  const monto = numeroONull(r.monto);
  const cuenta = typeof r.cuenta_id === "string" && idsCuenta.has(r.cuenta_id) ? r.cuenta_id : null;
  const categoria = typeof r.categoria_id === "string" && idsCategoria.has(r.categoria_id) ? r.categoria_id : null;
  if (!tieneEvidenciaDeTipo(transcripcion, tipo)) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;
  const monedaMovimiento = moneda(r.moneda);
  if (!monedaApareceEnTranscripcion(monedaMovimiento, transcripcion)) return null;
  if (cuenta) { const cuentaCatalogo = cuentas.find((c) => c.id === cuenta); if (!cuentaCatalogo || !textoContieneFrase(transcripcion, cuentaCatalogo.name)) return null; }
  if (!descripcion && monto == null) return null;
  return { descripcion, monto, moneda: monedaMovimiento, cuenta_id: cuenta, categoria_id: categoria };
}
function textoContieneFrase(texto: string, frase: string): boolean { const a = quitarAcentos(texto.toLowerCase()).replace(/\s+/g, " ").trim(); const b = quitarAcentos(frase.toLowerCase()).replace(/\s+/g, " ").trim(); return Boolean(b) && a.includes(b); }
function normalizarDeuda(d: unknown, transcripcion: string): DeudaVoz | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const quien = textoONull(r.quien), motivo = textoONull(r.motivo), monto = numeroONull(r.monto);
  if (!tieneEvidenciaDeTipo(transcripcion, "deuda")) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;
  const monedaDeuda = moneda(r.moneda);
  if (!monedaApareceEnTranscripcion(monedaDeuda, transcripcion)) return null;
  if (!quien && !motivo && monto == null) return null;
  return { quien, monto, moneda: monedaDeuda, motivo };
}

export async function interpretarAudio(opts: { audioBase64: string; mimeType: string; cuentas: CuentaCatalogo[]; categoriasGasto: CategoriaCatalogo[]; categoriasIngreso: CategoriaCatalogo[]; hoy: string }): Promise<ResultadoVoz> {
  const audioBase64 = opts.audioBase64.replace(/^data:[^,]*,/, "").trim();
  if (!audioBase64) return { gastos: [], ingresos: [], deudas: [], transcripcion: null };
  const audioBytes = Math.floor((audioBase64.length * 3) / 4);
  if (!Number.isInteger(audioBytes) || audioBytes <= 0) return { gastos: [], ingresos: [], deudas: [], transcripcion: null };
  if (audioBytes > MAX_AUDIO_BYTES) throw new Error("El audio supera el límite de 10 MB.");
  const mimeType = opts.mimeType.trim().toLowerCase().split(";")[0];
  const mimePermitidos = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"]);
  if (!mimePermitidos.has(mimeType)) throw new Error("Formato de audio no soportado.");
  const prompt = construirPrompt(opts.cuentas, opts.categoriasGasto, opts.categoriasIngreso, opts.hoy);
  const textoModelo = await llamarVertex(prompt, audioBase64, mimeType);
  return parsear(textoModelo, opts.cuentas, opts.categoriasGasto, opts.categoriasIngreso);
}