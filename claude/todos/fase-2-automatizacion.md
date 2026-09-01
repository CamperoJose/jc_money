# Fase 2 — Automatización · TODOs

## Registro de gasto por voz (Gemini)
- [ ] 🤖 Ruta `POST /api/ingesta` protegida por token Bearer (comparación en tiempo constante).
- [ ] 🤖 Enviar audio directo a Gemini Flash con prompt de sistema en español que exija JSON del esquema fijo.
- [ ] 🤖 Validar salida: mapear `category`/`account` contra catálogos; fecha = hoy si falta.
- [ ] 🤖 Insertar `transactions` con `source='voz'` y guardar `raw_voice_text`.
- [ ] 🤖 UI de confirmación/corrección antes de dar por bueno.
- [ ] 👤 Obtener API key de Gemini. → `cosas_manuales.md`

Esquema de salida de Gemini: `{type, amount, currency, category, account, description, date, confidence}`.

## Correos (Nodemailer + Gmail SMTP)
- [ ] 👤 Crear app password de Gmail. → `cosas_manuales.md`
- [ ] 🤖 Configurar Nodemailer con SMTP de Gmail.
- [ ] 🤖 Plantillas en español.

## Recordatorios
- [ ] 🤖 Tabla `reminders` (ya en el esquema). Ruta `POST /api/recordatorios/despachar` (Bearer).
- [ ] 🤖 Casos: vencimiento de DPF con anticipación, deuda por cobrar/pagar.
- [ ] 👤 Definir anticipación deseada (spec §18).

## Correo de estado
- [ ] 🤖 Ruta `POST /api/estado/enviar` (Bearer): patrimonio actual, gasto del mes, próximos vencimientos.
- [ ] 👤 Definir frecuencia (semanal/mensual, spec §18).

## Scheduler externo (no el cron de Vercel)
- [ ] 🤖 GitHub Actions con `schedule` (o cron-job.org) que llama a las rutas con el token Bearer.
- [ ] 👤 Cargar el token como secret (GitHub Actions y/o cron-job.org). → `cosas_manuales.md`

## Respaldos a Google Drive
- [ ] 👤 Crear service account + habilitar Drive API + compartir carpeta destino. → `cosas_manuales.md`
- [ ] 🤖 Ruta `POST /api/respaldo/ejecutar` (Bearer): volcado SQL + CSV por tabla.
- [ ] 🤖 Subida versionada por fecha a la carpeta de Drive.
- [ ] 👤 Confirmar política de retención (propuesta: 30 diarios + 12 mensuales).

## Cierre de fase
- [ ] 🤖 Actualizar `claude/estado.md`.
