import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Estructura mínima del service account de Google que usamos. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

let cache: ServiceAccount | null = null;

/**
 * Carga el service account de Google (Vertex AI). Orden de resolución:
 *  1. Variable de entorno `GCP_SA_JSON` (JSON crudo o base64) — útil si algún día
 *     se quiere sacar la credencial del repo sin tocar código.
 *  2. Archivo versionado en el repo `credenciales/vertex-ai.json` (decisión del
 *     usuario: la credencial vive en el repo).
 * Se cachea en memoria del proceso serverless.
 */
export function cargarServiceAccount(): ServiceAccount {
  if (cache) return cache;

  const raw = leerRaw();
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("La credencial de Google (service account) no es un JSON válido.");
  }
  if (!sa.client_email || !sa.private_key || !sa.token_uri || !sa.project_id) {
    throw new Error("La credencial de Google está incompleta (faltan campos).");
  }
  cache = sa;
  return sa;
}

function leerRaw(): string {
  const env = process.env.GCP_SA_JSON?.trim();
  if (env) {
    // Puede venir como JSON crudo o codificado en base64.
    if (env.startsWith("{")) return env;
    try {
      return Buffer.from(env, "base64").toString("utf8");
    } catch {
      return env;
    }
  }
  const ruta = join(process.cwd(), "credenciales", "vertex-ai.json");
  try {
    return readFileSync(ruta, "utf8");
  } catch {
    throw new Error(
      "No se encontró la credencial de Google: define GCP_SA_JSON o incluye credenciales/vertex-ai.json."
    );
  }
}
