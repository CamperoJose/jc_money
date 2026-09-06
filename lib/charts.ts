// Utilidades para ejes de tiempo en Recharts.
//
// Por defecto, un XAxis con `dataKey` de tipo texto es un eje CATEGÓRICO: todas
// las muestras quedan a la misma distancia entre sí, sin importar cuántos días
// pasaron entre una y otra. En este proyecto las fotos de patrimonio y los
// registros de tipo de cambio son irregulares (a veces meses de diferencia), así
// que hay que usar un eje numérico con escala de tiempo para que la distancia
// horizontal represente el tiempo real.
import { BOLIVIA_OFFSET } from "@/lib/format";

const DIA_MS = 86_400_000;

/**
 * Paleta categórica única para todos los gráficos con varias series (cuentas,
 * categorías, entidades). Arranca con las mismas cinco familias de la plantilla
 * —azul, esmeralda, violeta, ámbar, cian— para que el primer color coincida con
 * el primario del tema, y sigue con tonos extra para listas largas. Todos los
 * tonos son legibles sobre fondo claro y oscuro.
 */
export const PALETA_CATEGORICA = [
  "#2563eb", // azul (primario)
  "#059669", // esmeralda
  "#7c3aed", // violeta
  "#d97706", // ámbar
  "#0891b2", // cian
  "#db2777", // rosa
  "#4f46e5", // índigo
  "#0d9488", // teal
  "#ea580c", // naranja
  "#65a30d", // lima
  "#e11d48", // carmín
  "#0284c7", // celeste
];

/** Fecha 'YYYY-MM-DD' → epoch ms al mediodía de Bolivia. */
export function tsDeFecha(fecha: string): number {
  // Mediodía y no medianoche: así ningún desfase de zona horaria mueve el punto
  // al día anterior o siguiente.
  const t = new Date(`${fecha}T12:00:00${BOLIVIA_OFFSET}`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Agrega el campo `ts` (epoch ms) a una serie que tiene `fecha`. */
export function conTs<T extends { fecha: string }>(datos: T[]): Array<T & { ts: number }> {
  return datos.map((d) => ({ ...d, ts: tsDeFecha(d.fecha) }));
}

/** Días que abarca la serie, para decidir el formato de las marcas del eje. */
export function rangoEnDias(ts: number[]): number {
  if (ts.length < 2) return 0;
  return (Math.max(...ts) - Math.min(...ts)) / DIA_MS;
}

/**
 * Formato de las marcas del eje según el rango: días para series cortas, mes y
 * año para series largas. Evita ejes ilegibles con muchos años de historia.
 */
export function formatoMarcaTiempo(rangoDias: number) {
  const opciones: Intl.DateTimeFormatOptions =
    rangoDias > 730
      ? { month: "short", year: "2-digit" }
      : rangoDias > 120
        ? { month: "short", year: "2-digit" }
        : rangoDias > 20
          ? { day: "2-digit", month: "short" }
          : { day: "2-digit", month: "short" };
  const fmt = new Intl.DateTimeFormat("es-BO", { ...opciones, timeZone: "America/La_Paz" });
  return (ts: number) => fmt.format(new Date(ts)).replace(".", "");
}

/** Fecha completa para los tooltips (a partir del timestamp del eje). */
export function formatoFechaTooltip(ts: number): string {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  }).format(new Date(ts));
}

/**
 * Props comunes del eje de tiempo. `scale="time"` reparte las marcas en fechas
 * redondas (inicios de mes, de año) en vez de una por muestra.
 */
export function propsEjeTiempo(rangoDias: number) {
  return {
    dataKey: "ts" as const,
    type: "number" as const,
    scale: "time" as const,
    domain: ["dataMin", "dataMax"] as [string, string],
    tickFormatter: formatoMarcaTiempo(rangoDias),
    minTickGap: 28,
  };
}

/** Días transcurridos entre dos timestamps, redondeados. */
export function diasEntreTs(a: number, b: number): number {
  return Math.round(Math.abs(b - a) / DIA_MS);
}
