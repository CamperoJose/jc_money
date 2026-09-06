"use client";

import { cn } from "@/lib/utils";

/** Rangos de tiempo disponibles para los gráficos históricos. */
export const RANGOS = [
  { id: "3m", label: "3M", dias: 90 },
  { id: "6m", label: "6M", dias: 180 },
  { id: "1a", label: "1A", dias: 365 },
  { id: "todo", label: "Todo", dias: Infinity },
] as const;

export type RangoId = (typeof RANGOS)[number]["id"];
export const IDS_RANGO = RANGOS.map((r) => r.id);

/** Recorta una serie con timestamp a los últimos N días del rango elegido. */
export function recortarPorRango<T extends { ts: number }>(datos: T[], rango: RangoId): T[] {
  const def = RANGOS.find((r) => r.id === rango);
  if (!def || def.dias === Infinity || datos.length === 0) return datos;
  // El corte se mide desde la última muestra, no desde hoy: si hace meses que no
  // registras, "3M" seguiría mostrando algo en vez de quedar vacío.
  const fin = Math.max(...datos.map((d) => d.ts));
  const desde = fin - def.dias * 86_400_000;
  const recortado = datos.filter((d) => d.ts >= desde);
  // Con menos de dos puntos no hay línea que dibujar: se devuelve todo.
  return recortado.length >= 2 ? recortado : datos;
}

export function SelectorRango({
  valor,
  onChange,
  className,
}: {
  valor: RangoId;
  onChange: (r: RangoId) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Rango de tiempo"
      className={cn("flex gap-1 rounded-lg border border-border bg-muted/40 p-1", className)}
    >
      {RANGOS.map((r) => {
        const activo = valor === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            aria-pressed={activo}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activo
                ? "bg-primary bg-gradient-to-b from-white/15 to-transparent text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
