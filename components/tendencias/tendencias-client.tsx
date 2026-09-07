"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Bar,
  BarChart,
  Cell,
} from "recharts";
import {
  TrendUp,
  ChartLineUp,
  Target,
  Percent,
  Sparkle,
  Speedometer,
  ArrowLineDown,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/tremor/kpi-card";
import {
  conTs,
  rangoEnDias,
  propsEjeTiempo,
  formatoFechaTooltip,
  tsDeFecha,
} from "@/lib/charts";
import { usePreferencia } from "@/lib/hooks/preferencia";
import {
  SelectorRango,
  recortarPorRango,
  IDS_RANGO,
  type RangoId,
} from "@/components/tremor/selector-rango";
import { ProgressCircle } from "@/components/tremor/progress-circle";
import { formatBob, formatBobCompact, formatPercent, formatDate, formatEje } from "@/lib/format";
import type { ResumenTendencias } from "@/lib/tendencias";
import type { AnalisisGastos } from "@/lib/analisis";
import { ListaHallazgos } from "@/components/tendencias/hallazgos";
import { PatronesGasto } from "@/components/tendencias/patrones-gasto";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

export function TendenciasClient({
  t,
  gastos,
}: {
  t: ResumenTendencias;
  gastos: AnalisisGastos | null;
}) {
  // Antes del early return: las reglas de hooks exigen que se llame siempre.
  const [rangoElegido, setRangoElegido] = usePreferencia<RangoId>(
    "tendencias.rango",
    "todo",
    IDS_RANGO as RangoId[]
  );

  if (!t.suficienteData) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5"><h1 className="text-2xl font-semibold text-foreground">Tendencias</h1></div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <ChartLineUp weight="duotone" className="size-8 opacity-60" />
            {t.narrativa}
          </CardContent>
        </Card>
        {/* Aunque falten fotos de patrimonio puede haber gastos de sobra que
            analizar; no tiene sentido esconderlos detrás del mismo vacío. */}
        {gastos?.suficienteData && (
          <>
            <ListaHallazgos hallazgos={gastos.hallazgos} titulo="Patrones en tus gastos" />
            <PatronesGasto a={gastos} />
          </>
        )}
      </div>
    );
  }

  // Eje de tiempo real: el histórico viene de fotos irregulares y la proyección
  // es mensual, así que en un eje categórico ambos tramos se veían con el mismo
  // paso y la pendiente resultaba engañosa.
  // El rango recorta solo el tramo histórico: la proyección se muestra siempre
  // completa, porque es justo lo que se quiere ver en esta pantalla.
  const todos = conTs(t.puntos);
  const historico = todos.filter((p) => p.real != null);
  const proyectado = todos.filter((p) => p.real == null);
  const data = [...recortarPorRango(historico, rangoElegido), ...proyectado];
  const rango = rangoEnDias(data.map((p) => p.ts));
  const ultimoRealIdx = t.puntos.reduce((acc, p, i) => (p.real != null ? i : acc), 0);
  const fechaCorte = t.puntos[ultimoRealIdx]?.fecha;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Tendencias</h1>
        <p className="text-sm text-muted-foreground">
          Proyección estadística de tu patrimonio (regresión lineal + crecimiento compuesto).
        </p>
      </div>

      {/* Narrativa destacada */}
      <Card className="trama-rejilla resplandor">
        <CardContent className="flex items-start gap-3 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkle weight="fill" className="size-5" />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">Proyección</div>
            <p className="mt-1 text-base font-medium leading-snug">{t.narrativa}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Basado en {t.n} fotos entre {formatDate(t.desde)} y {formatDate(t.hasta)} · ajuste R² {t.r2 != null ? formatPercent(t.r2, 0) : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lo que los datos dicen, en frases */}
      <ListaHallazgos hallazgos={t.hallazgos} />

      {/* KPIs + confianza del ajuste */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta="Ritmo mensual"
          valor={`${(t.ritmoMensual ?? 0) >= 0 ? "+" : ""}${formatBobCompact(t.ritmoMensual)}`}
          detalle="Pendiente de la recta de tendencia"
          icono={<TrendUp weight="duotone" className="size-4" />}
          tono={(t.ritmoMensual ?? 0) >= 0 ? "pos" : "neg"}
        />
        <Kpi
          etiqueta="Crecimiento mensual"
          valor={t.crecimientoMensualPct == null ? "—" : formatPercent(t.crecimientoMensualPct, 2)}
          detalle="Compuesto sobre el patrimonio"
          icono={<Percent weight="duotone" className="size-4" />}
          tono={(t.crecimientoMensualPct ?? 0) >= 0 ? "pos" : "neg"}
        />
        <Kpi
          etiqueta="Patrimonio actual"
          valor={formatBobCompact(t.valorActual)}
          detalle={formatBob(t.valorActual)}
          icono={<Target weight="duotone" className="size-4" />}
        />
        <Kpi
          etiqueta="Ritmo de los últimos 90 días"
          valor={
            t.aceleracion.ritmoReciente == null
              ? "—"
              : `${t.aceleracion.ritmoReciente >= 0 ? "+" : ""}${formatBobCompact(t.aceleracion.ritmoReciente)}`
          }
          detalle={
            t.aceleracion.direccion === "sin_datos"
              ? "Sin tramo previo con el que comparar"
              : t.aceleracion.direccion === "estable"
                ? "En línea con el ritmo anterior"
                : `${t.aceleracion.direccion === "acelerando" ? "Más rápido" : "Más lento"} que antes (${t.aceleracion.ritmoPrevio! >= 0 ? "+" : ""}${formatBobCompact(t.aceleracion.ritmoPrevio)}/mes)`
          }
          icono={<Speedometer weight="duotone" className="size-4" />}
          tono={(t.aceleracion.ritmoReciente ?? 0) >= 0 ? "pos" : "neg"}
        />
        <Kpi
          etiqueta="Distancia al máximo"
          valor={t.drawdown && t.drawdown.monto > 0 ? `−${formatBobCompact(t.drawdown.monto)}` : "En el pico"}
          detalle={
            t.maximo
              ? t.drawdown && t.drawdown.monto > 0
                ? `${formatPercent(t.drawdown.pct, 1)} bajo el máximo del ${formatDate(t.maximo.fecha)}`
                : `Tu máximo histórico es ahora: ${formatBob(t.maximo.valor)}`
              : "—"
          }
          icono={<ArrowLineDown weight="duotone" className="size-4" />}
          tono={t.drawdown && t.drawdown.monto > 0 ? "neg" : "pos"}
        />
        <Kpi
          etiqueta="Volatilidad mensual"
          valor={t.volatilidadMensual == null ? "—" : `±${formatBobCompact(t.volatilidadMensual)}`}
          detalle="Cuánto varía un mes respecto de otro"
          icono={<ChartLineUp weight="duotone" className="size-4" />}
        />
        {/* Confianza del ajuste (R²) como anillo */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ProgressCircle
              value={t.r2 != null ? t.r2 * 100 : 0}
              radius={30}
              strokeWidth={6}
              variant={t.r2 == null ? "neutral" : t.r2 >= 0.8 ? "success" : t.r2 >= 0.5 ? "warning" : "error"}
            >
              <span className="text-[11px] font-bold tabular-nums">
                {t.r2 != null ? `${Math.round(t.r2 * 100)}%` : "—"}
              </span>
            </ProgressCircle>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Confianza (R²)
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold">
                {t.r2 == null ? "Sin datos" : t.r2 >= 0.8 ? "Tendencia clara" : t.r2 >= 0.5 ? "Tendencia moderada" : "Tendencia irregular"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {t.r2 != null && t.r2 < 0.5 ? "Toma la proyección con cautela" : "Ajuste de la recta"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico proyectado */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Proyección a futuro</CardTitle>
          <SelectorRango valor={rangoElegido} onChange={setRangoElegido} />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis {...propsEjeTiempo(rango)} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={formatEje} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number | [number, number], n) =>
                  Array.isArray(v)
                    ? [`${formatBob(v[0])} – ${formatBob(v[1])}`, "Rango probable"]
                    : [formatBob(v), n === "real" ? "Real" : "Proyección"]
                } labelFormatter={(l) => formatoFechaTooltip(Number(l))} />
              <Legend
                formatter={(v) => (v === "real" ? "Histórico" : v === "banda" ? "Rango probable (95%)" : "Proyección")}
                wrapperStyle={{ fontSize: 12 }}
              />
              {fechaCorte && (
                <ReferenceLine x={tsDeFecha(fechaCorte)} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" label={{ value: "hoy", position: "top", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              )}
              {/* La banda va PRIMERO para quedar por detrás de las líneas. */}
              <Area
                type="monotone"
                dataKey="banda"
                stroke="none"
                fill="var(--color-chart-3)"
                fillOpacity={0.14}
                connectNulls
                activeDot={false}
                isAnimationActive={false}
              />
              <Area type="monotone" dataKey="real" stroke="var(--color-chart-1)" fill="url(#gradReal)" strokeWidth={2.5} connectNulls dot={{ r: 2 }} />
              <Line type="monotone" dataKey="proyeccion" stroke="var(--color-chart-3)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            La banda es el rango donde, con los datos actuales, caería el valor real 19 de cada 20
            veces. Se ensancha con el horizonte porque la incertidumbre crece: la línea del centro
            es lo más probable, no una promesa.
          </p>
        </CardContent>
      </Card>

      {/* Cambio mes a mes: dónde se ganó y dónde se perdió */}
      {t.porMes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cuánto sumó o restó cada mes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Diferencia entre el cierre de cada mes y el del mes anterior.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                accessibilityLayer
                data={t.porMes.map((m) => ({ ...m, etiqueta: etiquetaMes(m.period) }))}
                margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={formatEje} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  formatter={(v: number) => [`${v >= 0 ? "+" : ""}${formatBob(v)}`, "Cambio"]}
                />
                {/* La línea del cero es imprescindible en un gráfico con signo:
                    sin ella no se distingue un mes flojo de uno negativo. */}
                <ReferenceLine y={0} stroke="var(--color-border)" />
                <Bar dataKey="cambio" radius={[4, 4, 0, 0]}>
                  {t.porMes.map((m) => (
                    <Cell
                      key={m.period}
                      fill={m.cambio >= 0 ? "var(--color-chart-1)" : "var(--color-destructive)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {t.mejorMes && t.peorMes && t.mejorMes.period !== t.peorMes.period && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Mejor mes</div>
                  <div className="text-sm font-semibold">
                    {etiquetaMes(t.mejorMes.period)} ·{" "}
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                      +{formatBob(t.mejorMes.cambio)}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Peor mes</div>
                  <div className="text-sm font-semibold">
                    {etiquetaMes(t.peorMes.period)} ·{" "}
                    <span className="tabular-nums text-destructive">{formatBob(t.peorMes.cambio)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Proyecciones por horizonte */}
        <Card>
          <CardHeader>
            <CardTitle>Si sigues así…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.proyecciones.map((p) => (
              <div key={p.meses} className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">En {p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDate(p.fecha)}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold tabular-nums text-primary">{formatBob(p.valorLineal)}</div>
                  {p.valorCompuesto != null && (
                    <div className="text-[11px] text-muted-foreground tabular-nums">compuesto {formatBobCompact(p.valorCompuesto)}</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Metas */}
        <Card>
          <CardHeader>
            <CardTitle>¿Cuándo llego a…?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.metas.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sin metas por encima del valor actual.</div>
            ) : (
              t.metas.map((m) => (
                <div key={m.objetivo} className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Target weight="duotone" className="size-4 text-primary" />
                    <span className="text-sm font-medium tabular-nums">{formatBob(m.objetivo)}</span>
                  </div>
                  <div className="text-right">
                    {m.fecha ? (
                      <>
                        <div className="text-sm font-semibold">{formatDate(m.fecha)}</div>
                        <div className="text-[11px] text-muted-foreground">en {m.dias} días</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">— a este ritmo</div>
                    )}
                  </div>
                </div>
              ))
            )}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Estimaciones sobre la tendencia actual; no son garantía. A mayor R², más fiable la proyección.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patrones de gasto: el otro lado de la misma historia */}
      {gastos?.suficienteData && (
        <>
          <div className="border-b border-border pb-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground">Patrones en tus gastos</h2>
            <p className="text-sm text-muted-foreground">
              Sobre {gastos.movimientos} movimientos registrados desde {formatDate(gastos.desde)}.
            </p>
          </div>
          <ListaHallazgos hallazgos={gastos.hallazgos} titulo="Qué se repite en tus gastos" />
          <PatronesGasto a={gastos} />
        </>
      )}
    </div>
  );
}

/** 'YYYY-MM' → "sep 2026", corto para que entre en el eje del gráfico. */
function etiquetaMes(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

