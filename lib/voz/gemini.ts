import { obtenerAccessToken } from "@/lib/gcp/token";
import { cargarServiceAccount } from "@/lib/gcp/credenciales";
import type { Currency } from "@/lib/types";
import type { DeudaVoz, GastoVoz, ResultadoVoz } from "@/lib/voz/tipos";

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

const REINTENTOS = 3;
const ESPERAS_MS = [1000, 3000]; // entre intentos

/** Host de Vertex AI según la ubicación ("global" usa el host sin prefijo). */
function hostVertex(location: string): string {
  return location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;
}

function construirPrompt(cuentas: CuentaCatalogo[], categorias: CategoriaCatalogo[], hoy: string): string {
  const listaCuentas = cuentas
    .map((c) => `- id="${c.id}" | nombre="${c.name}" | tipo=${c.type} | moneda=${c.currency}`)
    .join("\n");
  const listaCategorias = categorias.map((c) => `- id="${c.id}" | nombre="${c.name}"`).join("\n");

  return `Eres un asistente que interpreta comandos de voz en español boliviano para registrar
finanzas personales. La persona dicta uno o varios GASTOS y/o una o varias DEUDAS (dinero que
OTROS le deben a la persona) en un solo mensaje, sin orden fijo. Fecha de hoy: ${hoy}.

Distingue:
- GASTO: la persona pagó/compró/gastó algo. Ej: "gasté", "pagué", "compré", "me costó".
- DEUDA (que me deben): la persona prestó dinero o alguien le debe. Ej: "presté", "le fié",
  "me debe", "quedó debiendo", "por cobrar".

Para cada GASTO extrae:
- descripcion: qué se compró/pagó (texto corto).
- monto: número (sin moneda). Si NO se menciona un monto, usa null.
- moneda: "BOB" (por defecto en Bolivia), "USD" si dice dólares, "USDT" si dice USDT/tether.
- cuenta_id: el id de la cuenta con la que se pagó, eligiendo de la lista de CUENTAS por el
  nombre mencionado (ej. "efectivo", "BNB", "banco"). Si no se menciona o no hay coincidencia
  clara, usa null.
- categoria_id: el id de la CATEGORÍA de gasto que mejor corresponda a la descripción. Si no hay
  una coincidencia razonable, usa null.

Para cada DEUDA extrae:
- quien: nombre de quien debe, o null.
- monto: número, o null si no se dijo.
- moneda: "BOB" por defecto.
- motivo: motivo del préstamo, o null.

CUENTAS disponibles:
${listaCuentas || "(ninguna)"}

CATEGORÍAS de gasto disponibles:
${listaCategorias || "(ninguna)"}

Incluye también "transcripcion": lo que entendiste del audio, en texto natural.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{"transcripcion":"","gastos":[{"descripcion":"","monto":0,"moneda":"BOB","cuenta_id":null,"categoria_id":null}],"deudas":[{"quien":null,"monto":0,"moneda":"BOB","motivo":null}]}
Si no hay gastos, "gastos" es []. Si no hay deudas, "deudas" es []. No inventes montos ni cuentas.`;
}

interface VertexResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function llamarVertex(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
  const sa = cargarServiceAccount();
  const url =
    `${hostVertex(LOCATION)}/v1/projects/${sa.project_id}/locations/${LOCATION}` +
    `/publishers/google/models/${MODEL}:generateContent`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };

  let ultimoError = "";
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    let res: Response;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30_000); // no colgar indefinidamente
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

/** Limpia posibles fences ```json y parsea el JSON del modelo. */
function parsear(texto: string, cuentas: CuentaCatalogo[], categorias: CategoriaCatalogo[]): ResultadoVoz {
  let limpio = texto.trim();
  if (limpio.startsWith("```")) limpio = limpio.replace(/```[a-z]*\n?/gi, "").trim();

  let obj: unknown;
  try {
    obj = JSON.parse(limpio);
  } catch {
    throw new Error("No se pudo interpretar la respuesta del modelo.");
  }
  const raw = obj as { gastos?: unknown; deudas?: unknown; transcripcion?: unknown };
  const idsCuenta = new Set(cuentas.map((c) => c.id));
  const idsCat = new Set(categorias.map((c) => c.id));

  const gastos: GastoVoz[] = Array.isArray(raw.gastos)
    ? raw.gastos.map((g) => normalizarGasto(g, idsCuenta, idsCat)).filter((g): g is GastoVoz => g !== null)
    : [];
  const deudas: DeudaVoz[] = Array.isArray(raw.deudas)
    ? raw.deudas.map(normalizarDeuda).filter((d): d is DeudaVoz => d !== null)
    : [];

  return { gastos, deudas, transcripcion: textoONull(raw.transcripcion) };
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

function normalizarGasto(g: unknown, idsCuenta: Set<string>, idsCat: Set<string>): GastoVoz | null {
  if (!g || typeof g !== "object") return null;
  const r = g as Record<string, unknown>;
  const descripcion = textoONull(r.descripcion) ?? "";
  const cuenta = typeof r.cuenta_id === "string" && idsCuenta.has(r.cuenta_id) ? r.cuenta_id : null;
  const categoria = typeof r.categoria_id === "string" && idsCat.has(r.categoria_id) ? r.categoria_id : null;
  // Descarta entradas totalmente vacías.
  if (!descripcion && numeroONull(r.monto) == null) return null;
  return {
    descripcion,
    monto: numeroONull(r.monto),
    moneda: moneda(r.moneda),
    cuenta_id: cuenta,
    categoria_id: categoria,
  };
}

function normalizarDeuda(d: unknown): DeudaVoz | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const quien = textoONull(r.quien);
  const motivo = textoONull(r.motivo);
  const monto = numeroONull(r.monto);
  if (!quien && !motivo && monto == null) return null;
  return { quien, monto, moneda: moneda(r.moneda), motivo };
}

/** Interpreta un audio (base64) y devuelve gastos y deudas estructurados. */
export async function interpretarAudio(opts: {
  audioBase64: string;
  mimeType: string;
  cuentas: CuentaCatalogo[];
  categorias: CategoriaCatalogo[];
  hoy: string;
}): Promise<ResultadoVoz> {
  const prompt = construirPrompt(opts.cuentas, opts.categorias, opts.hoy);
  const texto = await llamarVertex(prompt, opts.audioBase64, opts.mimeType);
  return parsear(texto, opts.cuentas, opts.categorias);
}
