# Tendencias mensuales — 2026-09-30

- [x] Doce aperturas consecutivas al día 1, ancladas en la fecha de hoy Bolivia.
- [x] Base en vivo reutilizando el cálculo de patrimonio existente; fallback explícito.
- [x] Patrimonio y disponibilidad por flujos como lecturas separadas.
- [x] Calendario mensual de capital DPF y cuentas por cobrar, sin duplicar patrimonio.
- [x] Escenarios de ahorro adicional y exposición cambiaria neta; parámetros en URL.
- [x] Meta personal y horizontes visibles de 3, 6 y 12 meses.
- [x] Comparación temporal de tres modelos con cortes comunes y MAE/sesgo visibles.
- [x] Rangos orientativos por errores observados, sin prometer confianza probabilística.
- [x] Normalización por día, meses parciales, huecos y ventanas equivalentes de aceleración.
- [x] R² etiquetado como ajuste histórico; crecimiento diferenciado de rentabilidad.
- [x] Lectura paginada de fotos y movimientos; movimientos aislados por usuario autenticado.
- [x] Verificación manual de cálculos y de UI en escritorio y móvil.

No requiere migraciones ni nuevas dependencias. Los vencimientos son capital potencial:
no se supone cobro, pago de intereses ni reinversión. La lectura por flujos exige dos
meses utilizables de los tres anteriores; depende de la integridad de los registros.
