/** Fechas de calendario: sin depender de la zona horaria del servidor. */
export const DIAS_MES = 30.4375;
export interface FotoTendencia {
  fecha: string;
  bob: number;
}

export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const ms = Date.parse(`${fecha}T12:00:00Z`);
  return (
    Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === fecha
  );
}
export function diasEntre(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );
}
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function inicioMes(fecha: string, desplazamiento = 0): string {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + desplazamiento, 1, 12))
    .toISOString()
    .slice(0, 10);
}
export function proximasAperturas(hoy: string, meses = 12): string[] {
  return Array.from({ length: meses }, (_, i) => inicioMes(hoy, i + 1));
}
/** La entrada puede contener fotos manuales y auto: la última de cada día prevalece.
 * Los lectores deben entregarlas por snapshot_at y por id para desempatar. */
export function normalizarFotos(
  serie: FotoTendencia[],
  hasta?: string,
): FotoTendencia[] {
  const porFecha = new Map<string, FotoTendencia>();
  for (const p of serie) {
    if (
      !fechaValida(p.fecha) ||
      !Number.isFinite(p.bob) ||
      (hasta && p.fecha > hasta)
    )
      continue;
    porFecha.set(p.fecha, { ...p });
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
export function pendiente(serie: FotoTendencia[]): number | null {
  if (serie.length < 2) return null;
  const xs = serie.map((p) => diasEntre(serie[0].fecha, p.fecha));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = serie.reduce((s, p) => s + p.bob, 0) / serie.length;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return sxx > 0
    ? xs.reduce((s, x, i) => s + (x - mx) * (serie[i].bob - my), 0) / sxx
    : null;
}
export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
