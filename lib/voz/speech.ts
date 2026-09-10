import { obtenerAccessToken } from "@/lib/gcp/token";
import { cargarServiceAccount } from "@/lib/gcp/credenciales";

interface SpeechAlternative {
  transcript?: string;
  confidence?: number;
}

interface SpeechResult {
  alternatives?: SpeechAlternative[];
}

interface SpeechResponse {
  results?: SpeechResult[];
}

export interface TranscripcionVoz {
  texto: string;
  confianza: number | null;
}

const LOCATION = process.env.STT_LOCATION?.trim() || process.env.GCP_LOCATION?.trim() || "global";
const MODEL = process.env.STT_MODEL?.trim() || "latest_short";
const TIMEOUT_MS = 20_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Transcribe primero con Cloud Speech-to-Text. Este paso es deliberadamente
 * independiente de Gemini: si STT no detecta habla, Gemini nunca recibe el audio
 * y por tanto no puede convertir silencio en movimientos financieros.
 */
export async function transcribirAudio(opts: {
  audioBase64: string;
}): Promise<TranscripcionVoz | null> {
  const audioBytes = Math.floor((opts.audioBase64.length * 3) / 4);
  if (!Number.isFinite(audioBytes) || audioBytes <= 0) {
    throw new Error("El audio está vacío o es inválido.");
  }
  if (audioBytes > MAX_AUDIO_BYTES) {
    throw new Error("El audio supera el límite de 10 MB para la transcripción.");
  }

  const sa = cargarServiceAccount();
  const url =
    `https://speech.googleapis.com/v2/projects/${encodeURIComponent(sa.project_id)}` +
    `/locations/${encodeURIComponent(LOCATION)}/recognizers/_:recognize`;

  const body = {
    config: {
      autoDecodingConfig: {},
      languageCodes: ["es-419", "es-ES"],
      model: MODEL,
    },
    content: opts.audioBase64,
  };

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    const token = await obtenerAccessToken();
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error de red";
    throw new Error(`No se pudo contactar a Cloud Speech-to-Text: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 400);
    if (res.status === 403) {
      throw new Error(
        "Cloud Speech-to-Text devolvió 403. Habilita la API de Speech-to-Text y " +
          "otorga al service account permisos para usarla."
      );
    }
    throw new Error(`Cloud Speech-to-Text falló (HTTP ${res.status}). ${detail}`);
  }

  const data = (await res.json()) as SpeechResponse;
  const results = Array.isArray(data.results) ? data.results : [];
  const alternatives = results
    .map((r) => r.alternatives?.[0])
    .filter((a): a is SpeechAlternative => Boolean(a));
  const texto = alternatives
    .map((a) => (typeof a.transcript === "string" ? a.transcript.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // STT devuelve results=[] cuando no pudo reconocer habla. En ese caso se debe
  // abortar el flujo financiero, no intentar "adivinar" con otro modelo.
  if (!texto) return null;

  const confidencias = alternatives
    .map((a) => a.confidence)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  const confianza = confidencias.length
    ? confidencias.reduce((sum, n) => sum + n, 0) / confidencias.length
    : null;

  return { texto, confianza };
}
