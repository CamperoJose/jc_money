/** Formateo de moneda y fechas en español (Bolivia). */

export function formatBob(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Moneda compacta para KPIs (evita desbordes): "Bs 1,23 M", "Bs 45,2 K". */
export function formatBobCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 100000) return formatBob(n);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 100000) return formatUsd(n);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// --- Fecha + hora con zona de Bolivia (America/La_Paz, fijo GMT-4) -----------
// Bolivia no observa horario de verano, así que el offset es siempre -04:00.
export const BOLIVIA_OFFSET = "-04:00";
const BOLIVIA_TZ = "America/La_Paz";

/** ISO instantáneo → texto legible "01 sep 2026, 14:30" en hora Bolivia. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Solo la hora "14:30" en zona Bolivia. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-BO", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
