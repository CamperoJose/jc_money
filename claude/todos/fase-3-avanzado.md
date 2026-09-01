# Fase 3 — Avanzado · TODOs

## Simulador de proyección de laddering
- [ ] 🤖 Pantalla aparte con entradas configurables: monto inicial, aporte/periodo, cadencia (días),
      plazo DPF (días), tasa anual, salario bruto/líquido, horizonte (meses).
- [ ] 🤖 Lógica: cada periodo abre depósito = aporte + capital liberado que vence + aporte salario.
      Interés bruto = monto · tasa · plazo/360; líquido = bruto · 0.87 (RC-IVA 13%).
- [ ] 🤖 Salida: tabla proyectada (inicio/fin, monto, liberado, gcia bruta/líquida, aporte salario)
      + totales de ganancia y capital al horizonte. Recalcula al vuelo al cambiar cualquier supuesto.
- [ ] 🤖 Precargar supuestos base extraídos del Excel (plazo 90, tasa 0.077, cadencia 30, salario 10000/8729).
- [ ] (Opcional) 🤖 Persistir escenarios en `projection_scenarios`.

## Documentación de la API
- [ ] 🤖 Documentar todas las rutas (auth por cookie vs Bearer), esquemas de request/response.

## Preparación de Siri (futuro)
- [ ] 🤖 Confirmar que `POST /api/ingesta` acepta el token Bearer y un Atajo de Apple.
- [ ] 👤 Crear el Atajo de Siri que llame a la ruta con el token.

## Cierre de fase
- [ ] 🤖 Actualizar `claude/estado.md`.
