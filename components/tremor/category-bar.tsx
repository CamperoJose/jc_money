// Adaptado de Tremor CategoryBar. Barra segmentada con leyenda y marcador
// opcional. Los colores se pasan como CSS (hex o var()) para reusar la paleta
// de gráficos del proyecto.
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Segmento {
  etiqueta: string;
  valor: number;
  color: string; // CSS color: "#16a34a" o "var(--color-chart-1)"
}

export interface CategoryBarProps extends React.HTMLAttributes<HTMLDivElement> {
  segmentos: Segmento[];
  /** Marcador (ej. "hoy" o el gasto actual sobre el presupuesto). */
  marcador?: { valor: number; titulo?: string };
  /** Formatea los valores de la leyenda. */
  formato?: (n: number) => string;
  mostrarLeyenda?: boolean;
}

export function CategoryBar({
  segmentos,
  marcador,
  formato = (n) => String(n),
  mostrarLeyenda = true,
  className,
  ...props
}: CategoryBarProps) {
  const total = segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0);
  const pos =
    marcador && total > 0
      ? Math.min(100, Math.max(0, (marcador.valor / total) * 100))
      : null;

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="relative flex h-2.5 w-full items-center">
        <div className="flex h-full flex-1 items-center gap-0.5 overflow-hidden rounded-full bg-muted">
          {segmentos.map((s, i) => {
            const pct = total > 0 ? (Math.max(0, s.valor) / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={`${s.etiqueta}-${i}`}
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, background: s.color }}
                title={`${s.etiqueta}: ${formato(s.valor)}`}
              />
            );
          })}
        </div>
        {pos !== null && (
          <div
            className="absolute w-1 -translate-x-1/2 transition-all duration-500"
            style={{ left: `${pos}%` }}
            title={marcador?.titulo}
          >
            <div className="mx-auto h-4 w-1 rounded-full bg-foreground ring-2 ring-card" />
          </div>
        )}
      </div>

      {mostrarLeyenda && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {segmentos.map((s, i) => (
            <div key={`${s.etiqueta}-leyenda-${i}`} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="text-xs text-muted-foreground">{s.etiqueta}</span>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {formato(s.valor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
