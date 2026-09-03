import crypto from "node:crypto";
import { cargarServiceAccount, type ServiceAccount } from "@/lib/gcp/credenciales";

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

interface TokenCache {
  token: string;
  exp: number; // epoch segundos en que expira
}
let cache: TokenCache | null = null;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** Firma un JWT RS256 con la private key del service account. */
function firmarJwt(sa: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const input = `${header}.${claims}`;
  const firma = crypto.createSign("RSA-SHA256").update(input).sign(sa.private_key, "base64url");
  return `${input}.${firma}`;
}

/**
 * Devuelve un access token OAuth2 (Bearer) para llamar a Vertex AI, generándolo
 * a partir del service account (flujo JWT-bearer). Se cachea hasta ~1 min antes
 * de expirar para reutilizarlo entre invocaciones del mismo proceso.
 */
export async function obtenerAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cache && cache.exp - 60 > now) return cache.token;

  const sa = cargarServiceAccount();
  const jwt = firmarJwt(sa);

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`No se pudo obtener el token de Google (HTTP ${res.status}). ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google no devolvió access_token.");

  cache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}
