# Fase 2 — Automatización · TODOs

## Registro de gasto por voz (Gemini/Vertex) — ✅ HECHO (sesiones 14–16)
- [x] 🤖 Ruta `POST /api/voz/ingesta` protegida por token (Bearer, cabecera `x-api-token` o campo JSON).
- [x] 🤖 Audio directo a Vertex AI con prompt en español que exige JSON del esquema fijo.
- [x] 🤖 Validación: mapeo de `category`/`account` contra catálogos; fecha = hoy si falta.
- [x] 🤖 Inserta `transactions` con `source='voz'` y guarda `raw_voice_text`.
- [x] 🤖 Procesamiento **asíncrono** (`after()`): responde 202 al instante y luego envía el correo-recibo.
- [x] 🤖 Pestaña de auditoría "Solicitudes por voz" (`ai_requests`, migración `0014`).
- [x] 👤 Credenciales de Vertex en `GCP_SA_JSON` (nunca en el repo).

Esquema de salida de Gemini: `{type, amount, currency, category, account, description, date, confidence}`.

## Correos (Nodemailer + Gmail SMTP) — ✅ HECHO
- [x] 👤 App password de Gmail creada y cargada en las env vars.
- [x] 🤖 Nodemailer con SMTP de Gmail (con timeouts, para que no cuelgue la función serverless).
- [x] 🤖 Plantillas en español: correo-recibo del registro por voz y correo de alerta si falta un dato crítico.

## Recordatorios
- [ ] 🤖 Tabla `reminders` (ya en el esquema). Ruta `POST /api/recordatorios/despachar` (Bearer).
- [ ] 🤖 Casos: vencimiento de DPF con anticipación, deuda **por cobrar** vencida (no hay deudas propias, ver E2).
- [ ] 👤 Definir anticipación deseada (spec §18).

## Correo de estado
- [ ] 🤖 Ruta `POST /api/estado/enviar` (Bearer): patrimonio actual, gasto del mes, próximos vencimientos.
- [ ] 👤 Definir frecuencia (semanal/mensual, spec §18).

## Scheduler externo (no el cron de Vercel) — ✅ HECHO
- [x] 🤖 GitHub Actions (`.github/workflows/patrimonio-diario.yml`) llama al job con el token Bearer.
- [x] 👤 Token cargado como secret del repositorio.

## Respaldos a Google Drive — ❌ DESCARTADO
El usuario lo descartó en la sesión 19 (decisión E3 en `claude/decisiones.md`). No se implementará.
La ruta `api/respaldo` sigue excluida del middleware, pero queda sin uso.

## Cierre de fase
- [ ] 🤖 Actualizar `claude/estado.md`.
