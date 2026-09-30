"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendUp,
  ChartLineUp,
  Target,
  Percent,
  Speedometer,
  ArrowLineDown,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/tremor/kpi-card";
import { ProgressCircle } from "@/components/tremor/progress-circle";
import {
  formatBob,
  formatBobCompact,
  formatPercent,
  formatDate,
  formatEje,
} from "@/lib/format";
import type { ResumenTendencias } from "@/lib/tendencias";
import type { AnalisisGastos } from "@/lib/analisis";
import type { ProyeccionPatrimonio } from "@/lib/proyeccion-patrimonio";
import { ListaHallazgos } from "@/components/tendencias/hallazgos";
import { PatronesGasto } from "@/components/tendencias/patrones-gasto";
import { ProyeccionMensual } from "@/components/tendencias/proyeccion-mensual";

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
  proyeccion,
}: {
  t: ResumenTendencias;
  gastos: AnalisisGastos | null;
  proyeccion: ProyeccionPatrimonio;
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Tendencias</h1>
        <p className="text-sm text-muted-foreground">
          Aperturas mensuales, escenarios y lectura del comportamiento de tu
          patrimonio.
        </p>
      </div>
      <ProyeccionMensual p={proyeccion} historico={t.puntos} />
      {t.suficienteData ? (
        <>
          <div className="border-b border-border pb-3 pt-2">
            <h2 className="text-lg font-semibold">Cómo viene tu patrimonio</h2>
            <p className="text-sm text-muted-foreground">
              Lectura descriptiva del histórico, incluido el saldo actualizado
              cuando está disponible.
            </p>
          </div>
          <ListaHallazgos hallazgos={t.hallazgos} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              etiqueta="Ritmo histórico mensual"
              valor={`${(t.ritmoMensual ?? 0) >= 0 ? "+" : ""}${formatBobCompact(t.ritmoMensual)}`}
              detalle="Pendiente de la recta histórica; puede diferir del modelo elegido"
              icono={<TrendUp weight="duotone" className="size-4" />}
              tono={(t.ritmoMensual ?? 0) >= 0 ? "pos" : "neg"}
            />
            <Kpi
              etiqueta="Crecimiento histórico mensual"
              valor={
                t.crecimientoMensualPct == null
                  ? "—"
                  : formatPercent(t.crecimientoMensualPct, 2)
              }
              detalle="Incluye aportes y valorizaciones; no es rentabilidad"
              icono={<Percent weight="duotone" className="size-4" />}
              tono={(t.crecimientoMensualPct ?? 0) >= 0 ? "pos" : "neg"}
            />
            <Kpi
              etiqueta="Patrimonio de la base"
              valor={formatBobCompact(t.valorActual)}
              detalle={`Registrado al ${formatDate(t.hasta)}`}
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
                  ? "Sin ventanas comparables"
                  : t.aceleracion.direccion === "estable"
                    ? "En línea con los 90 días anteriores"
                    : `${t.aceleracion.direccion === "acelerando" ? "Más rápido" : "Más lento"} que los 90 días anteriores`
              }
              icono={<Speedometer weight="duotone" className="size-4" />}
              tono={(t.aceleracion.ritmoReciente ?? 0) >= 0 ? "pos" : "neg"}
            />
            <Kpi
              etiqueta="Distancia al máximo"
              valor={
                t.drawdown && t.drawdown.monto > 0
                  ? `−${formatBobCompact(t.drawdown.monto)}`
                  : "En el pico"
              }
              detalle={
                t.maximo
                  ? t.drawdown && t.drawdown.monto > 0
                    ? `${formatPercent(t.drawdown.pct, 1)} bajo el máximo del ${formatDate(t.maximo.fecha)}`
                    : `Máximo: ${formatBob(t.maximo.valor)}`
                  : "—"
              }
              icono={<ArrowLineDown weight="duotone" className="size-4" />}
              tono={t.drawdown && t.drawdown.monto > 0 ? "neg" : "pos"}
            />
            <Kpi
              etiqueta="Variabilidad mensual"
              valor={
                t.volatilidadMensual == null
                  ? "—"
                  : `±${formatBobCompact(t.volatilidadMensual)}`
              }
              detalle="Variación de cambios entre meses con cierres completos"
              icono={<ChartLineUp weight="duotone" className="size-4" />}
            />
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <ProgressCircle
                  value={(t.r2 ?? 0) * 100}
                  radius={30}
                  strokeWidth={6}
                  variant="neutral"
                >
                  <span className="text-[11px] font-bold tabular-nums">
                    {t.r2 != null ? `${Math.round(t.r2 * 100)}%` : "—"}
                  </span>
                </ProgressCircle>
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ajuste histórico (R²)
                  </div>
                  <div className="mt-0.5 text-sm font-semibold">
                    {t.r2 == null
                      ? "Sin datos"
                      : t.r2 >= 0.8
                        ? "Ajuste alto"
                        : t.r2 >= 0.5
                          ? "Ajuste moderado"
                          : "Ajuste bajo"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No mide la probabilidad de acertar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          {t.porMes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cuánto sumó o restó cada mes</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Diferencia entre los últimos registros de meses consecutivos.
                  Los periodos parciales no cuentan para rachas, extremos ni
                  variabilidad.
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    accessibilityLayer
                    data={t.porMes.map((m) => ({
                      ...m,
                      etiqueta: `${etiquetaMes(m.period)}${m.parcial ? " *" : ""}`,
                    }))}
                    margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="etiqueta"
                      tick={{
                        fontSize: 11,
                        fill: "var(--color-muted-foreground)",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: "var(--color-muted-foreground)",
                      }}
                      tickFormatter={formatEje}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                      formatter={(v: number) => [
                        `${v >= 0 ? "+" : ""}${formatBob(v)}`,
                        "Cambio registrado",
                      ]}
                    />
                    <ReferenceLine y={0} stroke="var(--color-border)" />
                    <Bar dataKey="cambio" radius={[4, 4, 0, 0]}>
                      {t.porMes.map((m) => (
                        <Cell
                          key={m.period}
                          fill={
                            m.cambio >= 0
                              ? "var(--color-chart-1)"
                              : "var(--color-destructive)"
                          }
                          fillOpacity={m.parcial ? 0.45 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs text-muted-foreground">
                  * Periodo parcial o sin cierres completos: se muestra como
                  referencia, no como resultado definitivo.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t.narrativa}
          </CardContent>
        </Card>
      )}
      {gastos?.suficienteData && (
        <>
          <div className="border-b border-border pb-3 pt-2">
            <h2 className="text-lg font-semibold text-foreground">
              Patrones en tus gastos
            </h2>
            <p className="text-sm text-muted-foreground">
              Sobre {gastos.movimientos} movimientos registrados desde{" "}
              {formatDate(gastos.desde)}.
            </p>
          </div>
          <ListaHallazgos
            hallazgos={gastos.hallazgos}
            titulo="Qué se repite en tus gastos"
          />
          <PatronesGasto a={gastos} />
        </>
      )}
    </div>
  );
}
function etiquetaMes(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "UTC",
    month: "short",
    year: "2-digit",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
