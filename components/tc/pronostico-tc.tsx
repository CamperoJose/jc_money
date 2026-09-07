"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartLineUp,
  Anchor,
  Target,
  Scales,
  Info,
  Warning,
  CheckCircle,
  TrendDown,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TableRoot, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/tremor/table";
import { conTs, rangoEnDias, propsEjeTiempo, formatoFechaTooltip, tsDeFecha } from "@/lib/charts";
import { formatNumber, formatPercent, formatDate, formatBob } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResultadoPronostico } from "@/lib/pronostico";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

const ICONO_TONO = {
  bueno: CheckCircle,
  malo: TrendDown,
  aviso: Warning,
  neutro: Info,
} as const;

const MARCO_TONO = {
  bueno: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400",
  malo: "border-destructive/30 bg-destructive/[0.06] text-destructive",
  aviso: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-400",
  neutro: "border-border bg-muted/40 text-muted-foreground",
} as const;

export function PronosticoTc({
  p,
  historico,
}: {
  p: ResultadoPronostico;
  /** Serie histórica completa, para dibujarla junto al pronóstico. */
  historico: { fecha: string; valor: number }[];
}) {
  if (!p.suficienteData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartLineUp weight="duotone" className="size-5 text-primary" />
            Pronóstico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            {p.motivo ?? "Todavía no hay historial suficiente."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Se dibujan los últimos 180 días de historia: con toda la serie, el tramo
  // pronosticado queda comprimido contra el borde derecho y no se lee.
  const cola = historico.slice(-180);
  const datos = [
    ...conTs(cola.map((h) => ({ fecha: h.fecha, real: h.valor, central: null as number | null, banda: null as [number, number] | null }))),
    ...conTs(
      p.puntos.map((q) => ({
        fecha: q.fecha,
        real: null as number | null,
        central: q.valor,
        banda: p.regimen === "anclado" ? null : ([q.inferior, q.superior] as [number, number]),
      }))
    ),
  ];
  // El último punto real también lleva valor central, para que la línea de
  // pronóstico salga de la serie en vez de aparecer flotando.
  if (cola.length > 0) {
    const ultimoReal = datos[cola.length - 1] as { central: number | null };
    ultimoReal.central = cola[cola.length - 1].valor;
  }
  const rango = rangoEnDias(datos.map((d) => d.ts));
  const corte = cola.length > 0 ? tsDeFecha(cola[cola.length - 1].fecha) : null;

  const anclado = p.regimen === "anclado";

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ChartLineUp weight="duotone" className="size-5 text-primary" />
          Pronóstico y análisis
        </h2>
        <p className="text-sm text-muted-foreground">
          Sobre {p.n} registros entre {formatDate(p.desde)} y {formatDate(p.hasta)}
          {p.nDisponibles > p.n &&
            ` · de ${p.nDisponibles} disponibles, se usan los más recientes: en un tipo de cambio, los datos de hace años pertenecen a otro régimen`}
          .
        </p>
      </div>

      {/* Titular: el régimen manda sobre todo lo demás */}
      <Card className={cn("trama-rejilla", anclado ? "" : "resplandor")}>
        <CardContent className="flex items-start gap-3 p-5">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm",
              anclado ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            {anclado ? <Anchor weight="fill" className="size-5" /> : <Target weight="fill" className="size-5" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                {anclado ? "Régimen anclado" : "Régimen móvil"}
              </span>
              {p.ganador && <Badge variant="neutral">{p.ganador.nombre}</Badge>}
            </div>
            <p className="mt-1 text-base font-medium leading-snug">{p.narrativa}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cambió {p.diasConCambio} de {p.n - 1} días ({formatPercent(p.proporcionCambio, 1)})
              {p.volatilidadAnual != null && ` · volatilidad anualizada ${formatPercent(p.volatilidadAnual, 1)}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico: historia + pronóstico + banda */}
      <Card>
        <CardHeader>
          <CardTitle>Proyección a {p.puntos.length} días</CardTitle>
          <CardDescription>
            {anclado
              ? "Sin banda: no hay incertidumbre que estimar mientras el ancla se sostenga."
              : `Banda del ${formatPercent(p.confianza, 0)} alrededor del valor más probable.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart accessibilityLayer data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="gradTcReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis {...propsEjeTiempo(rango)} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v) => formatNumber(v, 2)}
                width={56}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => formatoFechaTooltip(Number(v))}
                formatter={(v: number | [number, number], n) =>
                  Array.isArray(v)
                    ? [`${formatNumber(v[0], 4)} – ${formatNumber(v[1], 4)}`, "Rango probable"]
                    : [`Bs ${formatNumber(v, 5)}`, n === "real" ? "Registrado" : "Pronóstico"]
                }
              />
              <Legend
                formatter={(v) => (v === "real" ? "Registrado" : v === "banda" ? "Rango probable" : "Pronóstico")}
                wrapperStyle={{ fontSize: 12 }}
              />
              {/* La banda va primero, para quedar detrás de las líneas. */}
              <Area
                type="monotone" dataKey="banda" stroke="none" fill="var(--color-chart-3)"
                fillOpacity={0.16} connectNulls activeDot={false} isAnimationActive={false}
              />
              <Area
                type="monotone" dataKey="real" stroke="var(--color-chart-1)" fill="url(#gradTcReal)"
                strokeWidth={2} dot={false} connectNulls
              />
              <Line
                type="monotone" dataKey="central" stroke="var(--color-chart-3)" strokeWidth={2}
                strokeDasharray="6 4" dot={false} connectNulls
              />
              {corte != null && (
                <ReferenceLine
                  x={corte}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 3"
                  label={{ value: "hoy", position: "top", fontSize: 10, fill: "var(--color-muted-foreground)" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Qué significa para decidir */}
      {p.horizontes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scales weight="duotone" className="size-5 text-primary" />
              Qué significa para decidir
            </CardTitle>
            <CardDescription>
              Efecto sobre 1.000 USD guardados, medido en bolivianos. Positivo = te conviene
              haberlos tenido en dólares.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {/* Tarjetas en móvil: la tabla de 5 columnas es ilegible bajo 1024 px. */}
            <ul className="space-y-2 px-6 lg:hidden">
              {p.horizontes.map((h) => (
                <li key={h.dias} className="rounded-lg border bg-card/60 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{h.dias} días</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(h.fecha)}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold tabular-nums">{formatNumber(h.valor, 4)}</span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        !h.direccionSignificativa
                          ? "text-muted-foreground"
                          : h.efectoEn1000Usd >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                      )}
                    >
                      {h.efectoEn1000Usd >= 0 ? "+" : "−"}
                      {formatBob(Math.abs(h.efectoEn1000Usd))}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">/1.000 USD</span>
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground tabular-nums">
                    <span>Rango {formatNumber(h.inferior, 4)} – {formatNumber(h.superior, 4)}</span>
                    <span>
                      P(suba){" "}
                      {h.direccionSignificativa ? formatPercent(h.probabilidadSubir, 0) : "≈ mitad"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Horizonte</TableHeaderCell>
                    <TableHeaderCell className="text-right">T/C esperado</TableHeaderCell>
                    <TableHeaderCell className="text-right">Rango probable</TableHeaderCell>
                    <TableHeaderCell className="text-right">P(suba)</TableHeaderCell>
                    <TableHeaderCell className="text-right">Sobre 1.000 USD</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.horizontes.map((h) => (
                    <TableRow key={h.dias}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{h.dias} días</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(h.fecha)}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatNumber(h.valor, 4)}
                        <div
                          className={cn(
                            "text-[11px]",
                            !h.direccionSignificativa
                              ? "text-muted-foreground"
                              : h.cambioPct >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                          )}
                        >
                          {h.cambioPct >= 0 ? "+" : ""}
                          {formatPercent(h.cambioPct, 2)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {formatNumber(h.inferior, 4)} – {formatNumber(h.superior, 4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {h.direccionSignificativa ? (
                          <span className="font-medium">{formatPercent(h.probabilidadSubir, 0)}</span>
                        ) : (
                          // Sin dirección significativa, poner un porcentaje en
                          // negrita sería vender como señal lo que es ruido.
                          <span className="text-muted-foreground" title="El movimiento esperado no se distingue del ruido">
                            ≈ mitad
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          !h.direccionSignificativa
                            ? "text-muted-foreground"
                            : h.efectoEn1000Usd >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                        )}
                      >
                        {h.efectoEn1000Usd >= 0 ? "+" : "−"}
                        {formatBob(Math.abs(h.efectoEn1000Usd))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRoot>
            </div>
            <p className="px-6 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              «≈ mitad» significa que el movimiento esperado es más chico que el propio margen de
              error: a ese plazo el modelo no distingue si sube o baja, y actuar sobre esa cifra
              sería actuar sobre ruido.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Competencia entre modelos */}
      {p.competencia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cómo se eligió el modelo</CardTitle>
            <CardDescription>
              Validación de origen móvil: se corta la serie, se ajusta con lo anterior y se predice
              lo que vino después, avanzando el corte. Gana el de menor error fuera de muestra, y
              solo se prefiere a la caminata aleatoria si la mejora supera el 5%.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {/* En móvil, la comparación se lee mejor como lista ordenada. */}
            <ul className="space-y-2 px-6 lg:hidden">
              {p.competencia.map((m, i) => {
                const gana = p.ganador?.id === m.id;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-lg border p-3",
                      gana ? "border-primary/40 bg-primary/[0.06]" : "bg-card/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground tabular-nums">#{i + 1}</span>
                          <span className="text-sm font-medium">{m.nombre}</span>
                          {gana && <Badge variant="success">elegido</Badge>}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.supuesto}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          (m.mejoraVsCaminata ?? 0) > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {m.mejoraVsCaminata == null
                          ? "—"
                          : `${m.mejoraVsCaminata >= 0 ? "+" : ""}${formatPercent(m.mejoraVsCaminata, 1)}`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground tabular-nums">
                      <span>MAE {formatNumber(m.mae, 5)}</span>
                      <span>RMSE {formatNumber(m.rmse, 5)}</span>
                      <span>MAPE {formatPercent(m.mape, 3)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Modelo</TableHeaderCell>
                    <TableHeaderCell className="text-right">MAE</TableHeaderCell>
                    <TableHeaderCell className="text-right">RMSE</TableHeaderCell>
                    <TableHeaderCell className="text-right">MAPE</TableHeaderCell>
                    <TableHeaderCell className="text-right">vs. caminata</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.competencia.map((m) => {
                    const gana = p.ganador?.id === m.id;
                    return (
                      <TableRow key={m.id} className={gana ? "bg-primary/[0.06]" : undefined}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{m.nombre}</span>
                            {gana && <Badge variant="success">elegido</Badge>}
                          </div>
                          <div className="text-[11px] leading-snug text-muted-foreground">{m.supuesto}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(m.mae, 5)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber(m.rmse, 5)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatPercent(m.mape, 3)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            (m.mejoraVsCaminata ?? 0) > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {m.mejoraVsCaminata == null
                            ? "—"
                            : `${m.mejoraVsCaminata >= 0 ? "+" : ""}${formatPercent(m.mejoraVsCaminata, 1)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableRoot>
            </div>
            <p className="px-6 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              MAE y RMSE están en bolivianos; MAPE, en porcentaje del valor real. Evaluado a{" "}
              {p.competencia[0]?.evaluaciones ?? 0} pronósticos fuera de muestra por modelo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diagnósticos */}
      {p.diagnosticos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lo que este pronóstico NO te dice</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {p.diagnosticos.map((d) => {
                const Icono = ICONO_TONO[d.tono];
                return (
                  <li key={d.id} className={cn("flex gap-3 rounded-lg border p-3.5", MARCO_TONO[d.tono])}>
                    <Icono weight="duotone" className="mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-snug text-foreground">{d.titulo}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.detalle}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
