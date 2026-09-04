// Tarjetas KPI estilo Tremor, con tokens del tema.
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tono = "neutral" | "pos" | "neg";

const tonoBarra: Record<Tono, string> = {
  neutral: "bg-gradient-to-r from-primary/70 via-primary/30 to-transparent",
  pos: "bg-gradient-to-r from-emerald-500/80 via-emerald-500/30 to-transparent",
  neg: "bg-gradient-to-r from-destructive/80 via-destructive/30 to-transparent",
};

const tonoTexto: Record<Tono, string> = {
  neutral: "text-foreground",
  pos: "text-emerald-600 dark:text-emerald-400",
  neg: "text-destructive",
};

export interface KpiProps {
  etiqueta: string;
  valor: string;
  /** Línea secundaria bajo el valor. */
  detalle?: React.ReactNode;
  icono?: React.ReactNode;
  tono?: Tono;
  /** Barra de avance opcional (0..1). */
  progreso?: number;
  /** Color del acento del progreso (CSS). Por defecto, el primario. */
  colorProgreso?: string;
  className?: string;
}

/** KPI compacto: etiqueta arriba, valor grande, detalle y barra opcional. */
export function Kpi({
  etiqueta,
  valor,
  detalle,
  icono,
  tono = "neutral",
  progreso,
  colorProgreso,
  className,
}: KpiProps) {
  return (
    // Proporciones de la plantilla: etiqueta `text-sm font-medium` y valor
    // grande `text-3xl font-semibold`. La textura de puntos y el resplandor de
    // esquina le dan materia a la tarjeta sin restarle legibilidad a la cifra.
    <Card className={cn("trama-puntos resplandor", className)}>
      {/* Filo de acento superior, teñido según el tono del KPI. */}
      <div className={cn("h-0.5 w-full", tonoBarra[tono])} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{etiqueta}</span>
          {icono && <span className="shrink-0 text-muted-foreground">{icono}</span>}
        </div>
        <div className={cn("mt-1 truncate text-3xl font-semibold tabular-nums", tonoTexto[tono])}>
          {valor}
        </div>
        {detalle && (
          <div className="mt-1 truncate text-sm text-muted-foreground">{detalle}</div>
        )}
        {progreso != null && (
          <div className="canal mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="relleno-brillo h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, progreso * 100))}%`,
                backgroundColor: colorProgreso ?? "var(--color-primary)",
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Chip de variación (Δ) con flecha y color según signo. */
export function DeltaChip({
  valor,
  pct,
  sufijo,
  formato,
}: {
  valor: number | null;
  pct?: number | null;
  sufijo?: string;
  formato: (n: number) => string;
}) {
  if (valor == null) {
    return <span className="text-xs text-muted-foreground">Sin comparación</span>;
  }
  const cero = Math.abs(valor) < 0.005;
  const sube = valor > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cero
          ? "bg-muted text-muted-foreground ring-border"
          : sube
            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400"
            : "bg-destructive/10 text-destructive ring-destructive/30"
      )}
    >
      {cero ? "→" : sube ? "▲" : "▼"} {formato(Math.abs(valor))}
      {pct != null && !cero && (
        <span className="opacity-80">
          ({new Intl.NumberFormat("es-BO", { style: "percent", minimumFractionDigits: 1 }).format(
            Math.abs(pct)
          )}
          )
        </span>
      )}
      {sufijo && <span className="opacity-70">{sufijo}</span>}
    </span>
  );
}
