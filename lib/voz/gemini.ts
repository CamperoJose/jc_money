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

const PROMPT_SISTEMA = `Eres un parser financiero especializado en comandos de voz en español boliviano.

Tu trabajo tiene DOS pasos inseparables:
1) escuchar y transcribir fielmente el audio;
2) convertir SOLO los movimientos financieros realmente pronunciados al JSON solicitado.

ORDEN DE PRIORIDAD DE LAS REGLAS:

1. SEGURIDAD DEL AUDIO
- Si no hay habla humana inteligible, devuelve audio_con_habla=false, transcripcion="" y los tres arrays vacíos.
- No inventes palabras, montos, cuentas, categorías, personas ni movimientos.
- No conviertas horas, edades, teléfonos, fechas u otros números no financieros en movimientos.
- La regla de "asumir gasto" SOLO aplica después de detectar que la frase sí describe un movimiento financiero.

2. TRANSCRIPCIÓN
- transcripcion debe contener todo lo financiero que se oyó, no solo un resumen.
- Conserva nombres de comercios, productos, personas y cuentas tal como se entiendan.
- Puedes normalizar números hablados a dígitos para evitar ambigüedad: "treinta y cinco" -> "35", "tres con cincuenta" -> "3.50".
- No agregues información que no esté en el audio.

3. SEGMENTACIÓN
- Detecta CADA movimiento independiente. Nunca sumes ni agrupes movimientos distintos.
- "Netflix 45 y almuerzo 25" son DOS gastos.
- "pan 10, leche 8 y huevos 15" son TRES gastos.
- Un mismo audio puede mezclar gastos, ingresos y deudas.

4. CLASIFICACIÓN
- INGRESO solo cuando haya señal explícita de dinero recibido: "recibí", "me pagaron", "cobré", "me depositaron", "me entraron", "me abonaron", "sueldo", "salario", "venta", "reembolso" o equivalente inequívoco.
- DEUDA solo cuando sea explícito que otra persona le debe dinero al usuario: "me debe", "presté", "le fié", "por cobrar", "quedó debiendo" o equivalente.
- Si la frase describe un movimiento financiero pero NO dice explícitamente ingreso ni deuda, clasifícalo como GASTO, aunque no aparezcan las palabras "gasté", "pagué" o "compré".
- Ejemplos válidos de gasto implícito: "35 taxi", "Netflix 45", "30 del Fortaleza por unas papas", "efectivo 12 café".

5. MONTOS Y MONEDA
- Extrae únicamente montos realmente pronunciados.
- BOB es la moneda por defecto si no se menciona otra.
- USD solo si se oyen "dólares", "USD" o equivalente.
- USDT solo si se oye "USDT", "tether" o equivalente.
- Respeta centavos: "3 con 50", "3 punto 50", "3 coma 50", "3 bolivianos con 50 centavos" -> 3.50.
- No redondees ni conviertas 3.50 en 350.

6. CUENTAS
- Usa únicamente IDs del catálogo recibido.
- Una cuenta puede mencionarse de forma natural o abreviada. Si el catálogo dice "FortalezaBOB" y el usuario dice "Fortaleza", puedes asociarla si la coincidencia es inequívoca.
- Lo mismo aplica a sufijos de moneda como BOB, USD o USDT y palabras genéricas como "Banco" o "Cuenta".
- Si no hay una mención razonablemente clara de una cuenta concreta, cuenta_id=null.
- Nunca descartes un movimiento solo porque no se pudo identificar la cuenta.

7. CATEGORÍAS
- Usa únicamente IDs del catálogo recibido.
- Selecciona la categoría semánticamente más cercana; no hace falta coincidencia literal.
- Si no existe una categoría razonable o el catálogo está vacío, categoria_id=null.
- Nunca inventes IDs.

8. CAMPOS
- descripcion: concepto breve y fiel al audio.
- monto: número positivo o null si realmente no se entiende.
- quien y motivo en deudas: solo información realmente pronunciada.
- Mantén el orden de los movimientos cuando sea posible.

EJEMPLOS:
- "30 del Fortaleza por unas papas" => un GASTO de 30 BOB; cuenta Fortaleza si existe una única coincidencia razonable; descripción "papas".
- "Netflix 45 y almuerzo 25" => dos GASTOS separados.
- "me pagaron 250 al BNB por un trabajo" => un INGRESO de 250.
- "Juan me debe 80 del almuerzo" => una DEUDA de 80.
- "me depositaron 1000 de sueldo y 30 taxi" => un INGRESO de 1000 y un GASTO de 30.
- "reunión mañana a las 8" => ningún movimiento.

Devuelve únicamente JSON compatible con el esquema de respuesta.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    audio_con_habla: { type: "boolean" },
    transcripcion: { type: "string" },
    gastos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string" },
          monto: { type: "number", nullable: true },
          moneda: { type: "string", enum: ["BOB", "USD", "USDT"] },
          cuenta_id: { type: "string", nullable: true },
          categoria_id: { type: "string", nullable: true },
        },
        required: ["descripcion", "monto", "moneda", "cuenta_id", "categoria_id"],
      },
    },
    ingresos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string" },
          monto: { type: "number", nullable: true },
          moneda: { type: "string", enum: ["BOB", "USD", "USDT"] },
          cuenta_id: { type: "string", nullable: true },
          categoria_id: { type: "string", nullable: true },
        },
        required: ["descripcion", "monto", "moneda", "cuenta_id", "categoria_id"],
      },
    },
    deudas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quien: { type: "string", nullable: true },
          monto: { type: "number", nullable: true },
          moneda: { type: "string", enum: ["BOB", "USD", "USDT"] },
          motivo: { type: "string", nullable: true },
        },
        required: ["quien", "monto", "moneda", "motivo"],
      },
    },
  },
  required: ["audio_con_habla", "transcripcion", "gastos", "ingresos", "deudas"],
} as const;

function construirPrompt(cuentas: CuentaCatalogo[], categoriasGasto: CategoriaCatalogo[], categoriasIngreso: CategoriaCatalogo[], hoy: string): string {
  const listaCuentas = cuentas.map((c) => `- id="${c.id}" | nombre="${c.name}" | tipo=${c.type} | moneda=${c.currency}`).join("\n");
  const listaCategoriasGasto = categoriasGasto.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");
  const listaCategoriasIngreso = categoriasIngreso.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");

  return `Fecha de hoy en Bolivia: ${hoy}.

CUENTAS DISPONIBLES DEL USUARIO:
${listaCuentas || "(ninguna)"}

CATEGORÍAS DE GASTO:
${listaCategoriasGasto || "(ninguna)"}

CATEGORÍAS DE INGRESO:
${listaCategoriasIngreso || "(ninguna)"}

Interpreta el audio adjunto usando las reglas del sistema.
Recuerda: ingreso y deuda requieren evidencia explícita; cualquier otro movimiento financiero es gasto por defecto.
Usa exclusivamente IDs de estos catálogos y devuelve todos los movimientos independientes.`;
}

interface VertexResponse { candidates?: { content?: { parts?: { text?: string }[] } }[]; }

async function llamarVertex(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
  const sa = cargarServiceAccount();
  const url = `${hostVertex(LOCATION)}/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
    contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }] }],
    generationConfig: {
      temperature: 0,
      candidateCount: 1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };
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
const EVIDENCIA: Record<"gasto" | "ingreso" | "deuda", RegExp> = {
  gasto: /\b(gast|pagu|compr|cost|consum|adquir|salio|salida)\w*/i,
  ingreso: /\b(recib|pagaron|cobr|deposit|sueldo|salario|gan|ingres|entr[oó]|entraron|abon|transfirieron|devolvieron|reembolso|venta)\w*/i,
  deuda: /\b(prest|fi[eé]|debe|deben|deuda|debiendo|cobrar|prestado)\w*/i,
};
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

function normalizarNombreCuenta(nombre: string): string {
  return quitarAcentos(nombre.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(bob|usd|usdt)\b/g, " ")
    .replace(/(bob|usd|usdt)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cuentaMencionada(transcripcion: string, nombreCuenta: string): boolean {
  const texto = quitarAcentos(transcripcion.toLowerCase()).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const nombre = normalizarNombreCuenta(nombreCuenta);
  if (!nombre) return false;
  if (texto.includes(nombre)) return true;

  const genericas = new Set(["banco", "cuenta", "bob", "usd", "usdt", "bs", "bolivianos", "boliviano"]);
  const tokens = nombre.split(" ").filter((p) => p.length >= 3 && !genericas.has(p));
  const palabrasTexto = new Set(texto.split(" "));
  return tokens.length > 0 && tokens.some((p) => palabrasTexto.has(p));
}

function normalizarMovimiento(value: unknown, idsCuenta: Set<string>, idsCategoria: Set<string>, cuentas: CuentaCatalogo[], transcripcion: string, tipo: "gasto" | "ingreso"): GastoVoz | IngresoVoz | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const descripcion = textoONull(r.descripcion) ?? "";
  const monto = numeroONull(r.monto);
  const cuentaId = typeof r.cuenta_id === "string" && idsCuenta.has(r.cuenta_id) ? r.cuenta_id : null;
  const cuentaCatalogo = cuentaId ? cuentas.find((c) => c.id === cuentaId) : null;
  const cuenta = cuentaId && cuentaCatalogo && cuentaMencionada(transcripcion, cuentaCatalogo.name) ? cuentaId : null;
  const categoria = typeof r.categoria_id === "string" && idsCategoria.has(r.categoria_id) ? r.categoria_id : null;

  // Ingreso sí requiere una señal explícita. Gasto NO: por diseño es el tipo por defecto
  // cuando Gemini detecta un movimiento financiero que no es ingreso ni deuda.
  if (tipo === "ingreso" && !tieneEvidenciaDeTipo(transcripcion, "ingreso")) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;

  const monedaSolicitada = moneda(r.moneda);
  const monedaMovimiento = monedaSolicitada === "BOB" || monedaApareceEnTranscripcion(monedaSolicitada, transcripcion)
    ? monedaSolicitada
    : "BOB";

  if (!descripcion && monto == null) return null;
  return { descripcion, monto, moneda: monedaMovimiento, cuenta_id: cuenta, categoria_id: categoria };
}
function normalizarDeuda(d: unknown, transcripcion: string): DeudaVoz | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const quien = textoONull(r.quien), motivo = textoONull(r.motivo), monto = numeroONull(r.monto);
  if (!tieneEvidenciaDeTipo(transcripcion, "deuda")) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;
  const monedaSolicitada = moneda(r.moneda);
  const monedaDeuda = monedaSolicitada === "BOB" || monedaApareceEnTranscripcion(monedaSolicitada, transcripcion)
    ? monedaSolicitada
    : "BOB";
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