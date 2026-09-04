"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendDown, TrendUp, Calendar, ChartBar } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBob, formatBobCompact, formatPercent } from "@/lib/format";
import type { ResumenGastos } from "@/lib/queries/gastos";

const PALETA = [
  "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777",
  "#ea580c", "#ca8a04", "#0d9488", "#4f46e5", "#65a30d",
  "#e11d48", "#0284c7",
];

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

function nombreMes(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

export function GastosDashboard({ resumen }: { resumen: ResumenGastos }) {
  const {
    totalMesBob,
    variacionMesPct,
    conteoMes,
    promedioDiarioBob,
    porCategoria,
    porMes,
    topGastos,
    gasto7dias,
    promedio7dias,
    serie7dias,
  } = resumen;

  const mesActual = new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const dataMes = porMes.map((p) => ({ ...p, nombre: nombreMes(p.periodo) }));

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Gastos</h1>
        <p className="text-sm capitalize text-muted-foreground">{mesActual}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<TrendDown weight="duotone" className="size-5 text-destructive" />}
          label="Gasto del mes"
          valor={formatBob(totalMesBob)}
        />
        <Kpi
          icon={
            (variacionMesPct ?? 0) >= 0 ? (
              <TrendUp weight="duotone" className="size-5 text-destructive" />
            ) : (
              <TrendDown weight="duotone" className="size-5 text-primary" />
            )
          }
          label="vs. mes anterior"
          valor={
            variacionMesPct == null
              ? "—"
              : `${variacionMesPct >= 0 ? "+" : ""}${formatPercent(variacionMesPct)}`
          }
          tono={variacionMesPct == null ? undefined : variacionMesPct > 0 ? "malo" : "bueno"}
        />
        <Kpi
          icon={<Calendar weight="duotone" className="size-5 text-muted-foreground" />}
          label="Promedio diario"
          valor={formatBob(promedioDiarioBob)}
        />
        <Kpi
          icon={<ChartBar weight="duotone" className="size-5 text-muted-foreground" />}
          label="Movimientos del mes"
          valor={String(conteoMes)}
        />
      </div>

      {/* Gasto de los últimos 7 días */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Gasto de los últimos 7 días</CardTitle>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-destructive">{formatBob(gasto7dias)}</div>
              <div className="text-[11px] text-muted-foreground">promedio {formatBob(promedio7dias)}/día</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serie7dias} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => formatBobCompact(v)} width={64} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatBob(v), "Gasto"]} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="gastoBob" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gasto vs ingreso por mes */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto vs. ingreso por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {dataMes.length === 0 ? (
              <Vacio />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dataMes} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(v) => formatBobCompact(v)}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, n) => [formatBob(v), n === "gastoBob" ? "Gasto" : "Ingreso"]}
                  />
                  <Legend
                    formatter={(v) => (v === "gastoBob" ? "Gasto" : "Ingreso")}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="ingresoBob" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastoBob" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gasto por categoría (mes actual) */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto por categoría (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            {porCategoria.length === 0 ? (
              <Vacio />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="mx-auto aspect-square w-full max-w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={porCategoria}
                        dataKey="montoBob"
                        nameKey="nombre"
                        innerRadius="55%"
                        outerRadius="88%"
                        paddingAngle={2}
                      >
                        {porCategoria.map((_, i) => (
                          <Cell key={i} fill={PALETA[i % PALETA.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBob(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full min-w-0 flex-1 space-y-1.5">
                  {porCategoria.slice(0, 6).map((c, i) => (
                    <div key={c.nombre} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: PALETA[i % PALETA.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatPercent(c.pct)}</span>
                      <span className="shrink-0 text-right font-medium tabular-nums">{formatBob(c.montoBob)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top gastos del mes */}
      {topGastos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mayores gastos del mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGastos.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {t.description || t.category?.name || "Gasto"}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-destructive">
                  {formatBob(t.amount_bob)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  valor,
  tono,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  tono?: "bueno" | "malo";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          <span className="shrink-0">{icon}</span>
        </div>
        <div
          className={`mt-1 truncate text-3xl font-semibold tabular-nums ${
            tono === "malo" ? "text-destructive" : tono === "bueno" ? "text-primary" : ""
          }`}
        >
          {valor}
        </div>
      </CardContent>
    </Card>
  );
}

function Vacio() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      Sin datos para mostrar todavía.
    </div>
  );
}
