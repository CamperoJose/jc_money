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
import { TrendUp, ChartLineUp, Target, Percent, Sparkle } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/tremor/kpi-card";
import { ProgressCircle } from "@/components/tremor/progress-circle";
import { formatBob, formatBobCompact, formatPercent, formatDate } from "@/lib/format";
import type { ResumenTendencias } from "@/lib/tendencias";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

function etiquetaMesCorta(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function TendenciasClient({ t }: { t: ResumenTendencias }) {
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
      </div>
    );
  }

  const data = t.puntos.map((p) => ({ ...p, etiqueta: etiquetaMesCorta(p.fecha) }));
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
      <Card className="overflow-hidden">
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

      {/* KPIs + confianza del ajuste */}
      <div className="grid gap-3 lg:grid-cols-4">
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
        <CardHeader>
          <CardTitle>Proyección a futuro</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => formatBobCompact(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [formatBob(v), n === "real" ? "Real" : "Proyección"]} labelFormatter={(l) => l} />
              <Legend formatter={(v) => (v === "real" ? "Histórico" : "Proyección")} wrapperStyle={{ fontSize: 12 }} />
              {fechaCorte && (
                <ReferenceLine x={etiquetaMesCorta(fechaCorte)} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" label={{ value: "hoy", position: "top", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              )}
              <Area type="monotone" dataKey="real" stroke="var(--color-chart-1)" fill="url(#gradReal)" strokeWidth={2.5} connectNulls dot={{ r: 2 }} />
              <Line type="monotone" dataKey="proyeccion" stroke="var(--color-chart-3)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
    </div>
  );
}

