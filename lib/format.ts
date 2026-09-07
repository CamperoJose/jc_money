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

// `notation: "compact"` NO se puede usar aquí: el sufijo depende de la versión
// de ICU del entorno, y Node y Chromium no coinciden para es-BO (uno devuelve
// "Bs 110,74 K" y el otro "Bs 110,74 k"). Como estos valores se renderizan en
// el servidor y luego se hidratan en el cliente, esa diferencia de una letra
// rompía la hidratación y obligaba a React a rehacer el árbol entero.
// Por eso el sufijo se arma a mano: mismo resultado en los dos lados.
const ESCALAS = [
  { limite: 1e12, sufijo: " B" },
  { limite: 1e9, sufijo: " MM" },
  { limite: 1e6, sufijo: " M" },
  { limite: 1e3, sufijo: " K" },
] as const;

function compacto(n: number, moneda: "BOB" | "USD"): string {
  const signo = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const escala = ESCALAS.find((e) => abs >= e.limite);
  if (!escala) return moneda === "BOB" ? formatBob(n) : formatUsd(n);
  const valor = abs / escala.limite;
  // Dos decimales por debajo de 10, uno por encima: así "Bs 1,23 M" y
  // "Bs 110,7 K" ocupan un ancho parecido dentro de un KPI.
  const decimales = valor < 10 ? 2 : 1;
  const numero = new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
  return `${signo}${numero}${escala.sufijo}`;
}

/**
 * Número corto para los ejes de los gráficos: sin símbolo de moneda, porque
 * con él la etiqueta no entra en el ancho del eje y Recharts la parte en dos
 * líneas. El eje ya está rotulado por el contexto del gráfico.
 */
export function formatEje(n: number): string {
  if (!Number.isFinite(n)) return "";
  const signo = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const escala = ESCALAS.find((e) => abs >= e.limite);
  if (!escala) return `${signo}${new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(abs)}`;
  const valor = abs / escala.limite;
  return `${signo}${new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: valor < 10 ? 1 : 0,
  }).format(valor)}${escala.sufijo}`;
}

/** Moneda compacta para KPIs (evita desbordes): "Bs 1,23 M", "Bs 110,7 K". */
export function formatBobCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 100000) return formatBob(n);
  return compacto(n, "BOB");
}

export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 100000) return formatUsd(n);
  return compacto(n, "USD");
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
