import { obtenerAccessToken } from "@/lib/gcp/token";
import { cargarServiceAccount } from "@/lib/gcp/credenciales";
import type { Currency } from "@/lib/types";
import type { DeudaVoz, GastoVoz, IngresoVoz, ResultadoVoz } from "@/lib/voz/tipos";
import { transcribirAudio } from "@/lib/voz/speech";

export interface CuentaCatalogo {
  id: string;
  name: string;
  type: string;
  currency: string;
}
export interface CategoriaCatalogo {
  id: string;
  name: string;
}

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
const LOCATION = process.env.GCP_LOCATION?.trim() || "global";

const REINTENTOS = 2;
const ESPERAS_MS = [1500];
const TIMEOUT_MS = 25_000;

function hostVertex(location: string): string {
  return location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;
}

function construirPrompt(
  cuentas: CuentaCatalogo[],
  categoriasGasto: CategoriaCatalogo[],
  categoriasIngreso: CategoriaCatalogo[],
  hoy: string,
  transcripcion: string
): string {
  const listaCuentas = cuentas
    .map((c) => `- id="${c.id}" | nombre="${c.name}" | tipo=${c.type} | moneda=${c.currency}`)
    .join("\n");
  const listaCategoriasGasto = categoriasGasto.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");
  const listaCategoriasIngreso = categoriasIngreso.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");

  return `Eres un parser financiero estricto. La transcripción de abajo fue obtenida por un
servicio independiente de reconocimiento de voz. NO tienes acceso al audio y NO debes imaginar
lo que pudo haberse dicho.

Fecha de hoy: ${hoy}.

TRANSCRIPCIÓN VERIFICADA:
"""
${transcripcion}
"""

La persona puede dictar uno o varios GASTOS, INGRESOS y/o DEUDAS (dinero que OTROS le deben).
Solo registra información que esté explícita o inequívocamente contenida en la transcripción.
Si la transcripción no contiene una instrucción financiera, devuelve todos los arrays vacíos.

Distingue:
- GASTO: la persona pagó/compró/gastó algo. Ej: "gasté", "pagué", "compré", "me costó".
- INGRESO: la persona recibió dinero. Ej: "recibí", "me pagaron", "cobré", "me depositaron",
  "recibí mi sueldo".
- DEUDA (que me deben): la persona prestó dinero o alguien le debe. Ej: "presté", "le fié",
  "me debe", "quedó debiendo", "por cobrar".

Para cada GASTO extrae:
- descripcion: qué se compró/pagó (texto corto tomado de la transcripción).
- monto: número explícitamente mencionado. Si NO se menciona un monto, usa null.
- moneda: "BOB" por defecto en Bolivia, "USD" si dice dólares, "USDT" si dice USDT/tether.
- cuenta_id: el id de la cuenta con la que se pagó, SOLO de CUENTAS por el nombre mencionado.
  Si no se menciona o no hay coincidencia clara, usa null.
- categoria_id: el id de una CATEGORÍA DE GASTO razonable. Si no hay coincidencia, usa null.

Para cada INGRESO extrae:
- descripcion: origen del dinero (texto corto tomado de la transcripción).
- monto: número explícitamente mencionado. Si NO se menciona un monto, usa null.
- moneda: "BOB" por defecto en Bolivia, "USD" si dice dólares, "USDT" si dice USDT/tether.
- cuenta_id: el id de la cuenta DONDE SE RECIBIÓ el dinero, SOLO de CUENTAS por el nombre
  mencionado. Si no se menciona o no hay coincidencia clara, usa null.
- categoria_id: el id de una CATEGORÍA DE INGRESO razonable. Si no hay coincidencia, usa null.

REGLA IMPORTANTE DE CUENTAS: las CUENTAS pertenecen exclusivamente al usuario actual. Solo puedes
usar IDs de la lista proporcionada. Un nombre parecido no es suficiente si puede referirse a otra
cuenta. Si hay varias coincidencias posibles, usa null.

Para cada DEUDA extrae:
- quien: nombre de quien debe, o null.
- monto: número explícitamente mencionado, o null si no se dijo.
- moneda: "BOB" por defecto.
- motivo: motivo del préstamo, o null.

CUENTAS disponibles del usuario actual:
${listaCuentas || "(ninguna)"}

CATEGORÍAS DE GASTO disponibles del usuario actual:
${listaCategoriasGasto || "(ninguna)"}

CATEGORÍAS DE INGRESO disponibles del usuario actual:
${listaCategoriasIngreso || "(ninguna)"}

Responde ÚNICAMENTE con JSON válido, sin markdown, con esta forma exacta:
{"gastos":[{"descripcion":"","monto":0,"moneda":"BOB","cuenta_id":null,"categoria_id":null}],"ingresos":[{"descripcion":"","monto":0,"moneda":"BOB","cuenta_id":null,"categoria_id":null}],"deudas":[{"quien":null,"monto":0,"moneda":"BOB","motivo":null}]}
Si no hay gastos, ingresos o deudas, usa [] en el array correspondiente.
No inventes montos, cuentas, categorías, personas ni movimientos.`;
}

interface VertexResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function llamarVertex(prompt: string): Promise<string> {
  const sa = cargarServiceAccount();
  const url =
    `${hostVertex(LOCATION)}/v1/projects/${sa.project_id}/locations/${LOCATION}` +
    `/publishers/google/models/${MODEL}:generateContent`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };

  let ultimoError = "";
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    let res: Response;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const token = await obtenerAccessToken();
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : "error de red";
      if (intento < REINTENTOS) {
        await esperar(ESPERAS_MS[intento - 1]);
        continue;
      }
      throw new Error(`No se pudo contactar a Vertex AI: ${ultimoError}`);
    } finally {
      clearTimeout(timeout);
    }

    if (res.ok) {
      const data = (await res.json()) as VertexResponse;
      const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!texto.trim()) throw new Error("Vertex AI devolvió una respuesta vacía.");
      return texto;
    }

    const errBody = await res.text().catch(() => "");
    ultimoError = `HTTP ${res.status} ${errBody.slice(0, 300)}`;
    if (res.status === 403) {
      throw new Error(
        "Vertex AI devolvió 403 (permiso denegado). El service account necesita el rol " +
          "'Vertex AI User' (roles/aiplatform.user) y la API de Vertex AI habilitada."
      );
    }
    const reintentable = res.status === 429 || res.status >= 500;
    if (reintentable && intento < REINTENTOS) {
      await esperar(ESPERAS_MS[intento - 1]);
      continue;
    }
    break;
  }
  throw new Error(`Vertex AI falló: ${ultimoError}`);
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parsear(
  textoModelo: string,
  transcripcion: string,
  cuentas: CuentaCatalogo[],
  categoriasGasto: CategoriaCatalogo[],
  categoriasIngreso: CategoriaCatalogo[]
): ResultadoVoz {
  let limpio = textoModelo.trim();
  if (limpio.startsWith("```")) limpio = limpio.replace(/```[a-z]*\n?/gi, "").trim();

  let obj: unknown;
  try {
    obj = JSON.parse(limpio);
  } catch {
    throw new Error("No se pudo interpretar la respuesta del modelo.");
  }
  const raw = obj as { gastos?: unknown; ingresos?: unknown; deudas?: unknown };
  const idsCuenta = new Set(cuentas.map((c) => c.id));
  const idsCatGasto = new Set(categoriasGasto.map((c) => c.id));
  const idsCatIngreso = new Set(categoriasIngreso.map((c) => c.id));

  const gastos: GastoVoz[] = Array.isArray(raw.gastos)
    ? raw.gastos
        .map((g) => normalizarMovimiento(g, idsCuenta, idsCatGasto, cuentas, transcripcion, "gasto"))
        .filter((g): g is GastoVoz => g !== null)
    : [];
  const ingresos: IngresoVoz[] = Array.isArray(raw.ingresos)
    ? raw.ingresos
        .map((i) => normalizarMovimiento(i, idsCuenta, idsCatIngreso, cuentas, transcripcion, "ingreso"))
        .filter((i): i is IngresoVoz => i !== null)
    : [];
  const deudas: DeudaVoz[] = Array.isArray(raw.deudas)
    ? raw.deudas
        .map((d) => normalizarDeuda(d, transcripcion))
        .filter((d): d is DeudaVoz => d !== null)
    : [];

  return { gastos, ingresos, deudas, transcripcion };
}

function moneda(v: unknown): Currency {
  return v === "USD" || v === "USDT" ? v : "BOB";
}
function numeroONull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function textoONull(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : null;
}

const EVIDENCIA: Record<"gasto" | "ingreso" | "deuda", RegExp> = {
  gasto: /\b(gast|pagu|compr|cost|consum|adquir)\w*/i,
  ingreso: /\b(recib|pagaron|cobr|deposit|sueldo|salario|gan|ingres)\w*/i,
  deuda: /\b(prest|fi[eé]|debe|deben|deuda|debiendo|cobrar|prestado)\w*/i,
};

function tieneEvidenciaDeTipo(transcripcion: string, tipo: "gasto" | "ingreso" | "deuda"): boolean {
  return EVIDENCIA[tipo].test(transcripcion);
}

function transcripcionPareceFinanciera(transcripcion: string): boolean {
  return /\d|boliv|d[oó]lar|usd|usdt|tether|gast|pagu|compr|recib|cobr|deposit|sueldo|salario|prest|debe|deuda|fi[eé]/i.test(
    transcripcion
  );
}

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function montoApareceEnTranscripcion(monto: number | null, transcripcion: string): boolean {
  if (monto == null) return false;
  const texto = quitarAcentos(transcripcion.toLowerCase()).replace(/[,]/g, ".");
  const entero = Number.isInteger(monto) ? String(monto) : monto.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  if (new RegExp(`(?:^|\\D)${escapeRegExp(entero)}(?:\\D|$)`).test(texto)) return true;
  if (Number.isInteger(monto)) {
    const palabras = numeroEnPalabras(monto);
    if (palabras && texto.includes(quitarAcentos(palabras))) return true;
  }
  return false;
}

function monedaApareceEnTranscripcion(moneda: Currency, transcripcion: string): boolean {
  if (moneda === "BOB") return true;
  if (moneda === "USD") return /d[oó]lar|usd|d[oó]lares/i.test(transcripcion);
  return /usdt|tether/i.test(transcripcion);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numeroEnPalabras(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999999) return null;
  if (n === 0) return "cero";
  const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const especiales: Record<number, string> = {
    10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciseis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
    20: "veinte", 21: "veintiuno", 22: "veintidos", 23: "veintitres", 24: "veinticuatro",
    25: "veinticinco", 26: "veintiseis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
  };
  const decenas = ["", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const hasta999 = (x: number): string => {
    if (x < 10) return unidades[x];
    if (especiales[x]) return especiales[x];
    if (x < 100) return decenas[Math.floor(x / 10)] + (x % 10 ? ` y ${unidades[x % 10]}` : "");
    if (x === 100) return "cien";
    return centenas[Math.floor(x / 100)] + (x % 100 ? ` ${hasta999(x % 100)}` : "");
  };
  if (n < 1000) return hasta999(n);
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  return `${miles === 1 ? "mil" : `${hasta999(miles)} mil`}${resto ? ` ${hasta999(resto)}` : ""}`;
}

function normalizarMovimiento(
  value: unknown,
  idsCuenta: Set<string>,
  idsCategoria: Set<string>,
  cuentas: CuentaCatalogo[],
  transcripcion: string,
  tipo: "gasto" | "ingreso"
): GastoVoz | IngresoVoz | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const descripcion = textoONull(r.descripcion) ?? "";
  const monto = numeroONull(r.monto);
  const cuenta = typeof r.cuenta_id === "string" && idsCuenta.has(r.cuenta_id) ? r.cuenta_id : null;
  const categoria = typeof r.categoria_id === "string" && idsCategoria.has(r.categoria_id) ? r.categoria_id : null;

  // Defensa contra alucinaciones: el movimiento debe tener evidencia del tipo y
  // el monto en la transcripción. Sin monto explícito, queda incompleto y proceso.ts
  // lo descarta antes de insertar.
  if (!tieneEvidenciaDeTipo(transcripcion, tipo)) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;
  const monedaMovimiento = moneda(r.moneda);
  if (!monedaApareceEnTranscripcion(monedaMovimiento, transcripcion)) return null;

  // Una cuenta solo puede asignarse si su nombre fue realmente mencionado.
  if (cuenta) {
    const cuentaCatalogo = cuentas.find((c) => c.id === cuenta);
    if (!cuentaCatalogo || !textoContieneFrase(transcripcion, cuentaCatalogo.name)) return null;
  }

  if (!descripcion && monto == null) return null;
  return { descripcion, monto, moneda: monedaMovimiento, cuenta_id: cuenta, categoria_id: categoria };
}

function textoContieneFrase(texto: string, frase: string): boolean {
  const a = quitarAcentos(texto.toLowerCase()).replace(/\s+/g, " ").trim();
  const b = quitarAcentos(frase.toLowerCase()).replace(/\s+/g, " ").trim();
  return Boolean(b) && a.includes(b);
}

function normalizarDeuda(d: unknown, transcripcion: string): DeudaVoz | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const quien = textoONull(r.quien);
  const motivo = textoONull(r.motivo);
  const monto = numeroONull(r.monto);
  if (!tieneEvidenciaDeTipo(transcripcion, "deuda")) return null;
  if (monto != null && !montoApareceEnTranscripcion(monto, transcripcion)) return null;
  const monedaDeuda = moneda(r.moneda);
  if (!monedaApareceEnTranscripcion(monedaDeuda, transcripcion)) return null;
  if (!quien && !motivo && monto == null) return null;
  return { quien, monto, moneda: monedaDeuda, motivo };
}

/**
 * Transcribe primero con Speech-to-Text y solo después usa Gemini para estructurar
 * la transcripción. El audio nunca se entrega a Gemini directamente.
 */
export async function interpretarAudio(opts: {
  audioBase64: string;
  mimeType: string;
  cuentas: CuentaCatalogo[];
  categoriasGasto: CategoriaCatalogo[];
  categoriasIngreso: CategoriaCatalogo[];
  hoy: string;
}): Promise<ResultadoVoz> {
  void opts.mimeType;
  const reconocimiento = await transcribirAudio({ audioBase64: opts.audioBase64 });
  if (!reconocimiento) {
    return { gastos: [], ingresos: [], deudas: [], transcripcion: null };
  }

  if (!transcripcionPareceFinanciera(reconocimiento.texto)) {
    return { gastos: [], ingresos: [], deudas: [], transcripcion: reconocimiento.texto };
  }

  const prompt = construirPrompt(
    opts.cuentas,
    opts.categoriasGasto,
    opts.categoriasIngreso,
    opts.hoy,
    reconocimiento.texto
  );
  const textoModelo = await llamarVertex(prompt);
  return parsear(textoModelo, reconocimiento.texto, opts.cuentas, opts.categoriasGasto, opts.categoriasIngreso);
}
