-- ============================================================
-- Corrige el código de moneda del T/C: el dólar (venta) del WS del BCB es 12,
-- no 35 (35 devuelve CodError 1003 "moneda inválida"). Confirmado por un cliente
-- en producción que consume el mismo servicio.
-- Idempotente: solo cambia si aún está en 35.
-- ============================================================
update app_settings
  set value = '12'
  where key = 'tc_cod_moneda' and value = '35';
