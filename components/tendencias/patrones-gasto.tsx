"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUp, ArrowDown, ArrowsClockwise, CalendarBlank } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBob, formatBobCompact, formatPercent, formatDate, formatEje } from "@/lib/format";
import type { AnalisisGastos } from "@/lib/analisis";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

/** Abreviatura de tres letras: en móvil "miércoles" no entra en el eje. */
const CORTO: Record<string, string> = {
  domingo: "Dom",
  lunes: "Lun",
  martes: "Mar",
  miércoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sábado: "Sáb",
};

export function PatronesGasto({ a }: { a: AnalisisGastos }) {
  if (!a.suficienteData) return null;

  // La semana se muestra de lunes a domingo, como se vive, no de domingo a
  // sábado como la devuelve Date.getDay().
  const semana = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => a.porDiaSemana.find((x) => x.dia === d))
    .filter((x): x is NonNullable<typeof x> => x != null)
    .map((x) => ({ ...x, corto: CORTO[x.nombre] ?? x.nombre }));
  const maxDia = Math.max(...semana.map((d) => d.promedio), 0);

  const movimientos = [...a.categoriasEnAlza, ...a.categoriasEnBaja];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gasto medio por día de la semana */}
        <Card>
          <CardHeader>
            <CardTitle>Tu semana de gastos</CardTitle>
            <p className="text-xs text-muted-foreground">
              Promedio por día, dividiendo entre los días de ese nombre que hubo en el periodo.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart accessibilityLayer data={semana} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="corto" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={formatEje} width={46} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  formatter={(v: number) => [formatBob(v), "Promedio"]}
                  labelFormatter={(l, p) => {
                    const d = p?.[0]?.payload;
                    return d ? `${d.nombre} · ${d.movimientos} movimiento(s)` : String(l);
                  }}
                />
                <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                  {semana.map((d) => (
                    // El día más caro se resalta; el resto queda apagado, para
                    // que el contraste haga el trabajo sin meter otro color.
                    <Cell
                      key={d.dia}
                      fill="var(--color-chart-1)"
                      fillOpacity={d.promedio === maxDia && maxDia > 0 ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Categorías que se movieron */}
        <Card>
          <CardHeader>
            <CardTitle>Categorías que se movieron</CardTitle>
            <p className="text-xs text-muted-foreground">
              Lo que llevás este mes contra lo que llevarías a esta altura, según los meses previos.
            </p>
          </CardHeader>
          <CardContent>
            {movimientos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ninguna categoría se movió de forma apreciable. Hacen falta al menos dos meses
                previos para comparar.
              </p>
            ) : (
              <ul className="space-y-2">
                {movimientos.map((c) => {
                  const sube = c.variacion > 0;
                  return (
                    <li
                      key={c.categoria}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {sube ? (
                          <ArrowUp weight="bold" className="size-4 shrink-0 text-destructive" />
                        ) : (
                          <ArrowDown weight="bold" className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.categoria}</div>
                          {/* Sin `truncate`: en pantallas de 320 px esta línea
                              se cortaba y se perdía la cifra esperada, que es
                              justo la mitad de la comparación. Mejor que baje. */}
                          <div className="text-[11px] leading-snug text-muted-foreground tabular-nums">
                            {formatBob(c.actual)} · esperado {formatBob(c.referencia)}
                          </div>
                        </div>
                      </div>
                      <div
                        className={
                          sube
                            ? "shrink-0 text-sm font-bold tabular-nums text-destructive"
                            : "shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {sube ? "+" : ""}
                        {c.pct != null ? formatPercent(c.pct, 0) : "—"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gastos recurrentes */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ArrowsClockwise weight="duotone" className="size-5 text-primary" />
          <CardTitle>Gastos que se repiten</CardTitle>
        </CardHeader>
        <CardContent>
          {a.recurrentes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se detectó ningún gasto recurrente. Hacen falta al menos tres repeticiones con
              cadencia y monto parecidos.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {a.recurrentes.slice(0, 8).map((r) => (
                <li
                  key={`${r.descripcion}-${r.cadaDias}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.descripcion}</div>
                    <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <CalendarBlank weight="duotone" className="size-3 shrink-0" />
                      cada {r.cadaDias} días · visto {r.vecesVisto} veces · próximo{" "}
                      {formatDate(r.proximaEstimada)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums">{formatBob(r.montoTipico)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      ≈ {formatBobCompact((r.montoTipico * 30) / r.cadaDias)}/mes
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
