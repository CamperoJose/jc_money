# Credenciales (Vertex AI / voz)

El registro por voz (Gemini vía Vertex AI) usa un **service account de Google**.

> Nota: se intentó versionar `vertex-ai.json` en el repo, pero **GitHub Push
> Protection bloquea** cualquier commit que contenga la private key. Por eso la
> credencial va por **variable de entorno** (no versionada) y el archivo local
> `credenciales/vertex-ai.json` está en `.gitignore` (solo para desarrollo).

## Cómo configurar la credencial (Vercel)

Define en Vercel la variable de entorno **`GCP_SA_JSON`** con el **contenido del
JSON** del service account (pega el JSON tal cual; también acepta base64). El
código la prioriza sobre el archivo local.

En desarrollo local puedes dejar el archivo en `credenciales/vertex-ai.json`
(ignorado por git) o definir `GCP_SA_JSON` en `.env.local`.

## Rol IAM requerido

Para invocar el modelo (`generateContent`) el service account necesita:

- **Vertex AI User** (`roles/aiplatform.user`) — incluye `aiplatform.endpoints.predict`.

Los roles de "Service Agent" **no** bastan para invocar el modelo. Además, la
**Vertex AI API** debe estar habilitada en el proyecto `accl-507423`.

## Variables de entorno opcionales (Vercel)

- `GEMINI_MODEL` — modelo a usar (por defecto `gemini-2.5-flash`).
- `GCP_LOCATION` — ubicación de Vertex (por defecto `global`).
- `GCP_SA_JSON` — credencial alternativa (ver arriba).
