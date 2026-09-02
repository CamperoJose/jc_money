"use client";

import Link from "next/link";
import {
  Bank,
  Percent,
  Vault,
  Warning,
  CalendarCheck,
  ArrowRight,
  TrendUp,
} from "@phosphor-icons/react";
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBob, formatBobCompact, formatPercent, formatDate } from "@/lib/format";
import type { ResumenDpf } from "@/lib/dpf";
import type { DpfDepositUI } from "@/lib/types";

const PALETA = [
  "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777",
  "#ea580c", "#ca8a04", "#0d9488", "#4f46e5", "#65a30d",
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

export function DpfDashboard({ resumen }: { resumen: ResumenDpf }) {
  const {
    montoEnDpf,
    gananciaLiquida,
    gananciaBruta,
    rcIva,
    tasaPromedio,
    dpfsActivos,
    dpfsVencidos,
    rendimientoNeto,
    proximasLiberaciones,
    totalHistorico,
  } = resumen;

  // Capital vigente por entidad (pizarra) para el donut.
  const porEntidadMap = new Map<string, number>();
  for (const d of proximasLiberaciones) {
    const nombre = d.pizarra || "Sin entidad";
    porEntidadMap.set(nombre, (porEntidadMap.get(nombre) ?? 0) + d.principal);
  }
  const porEntidad = [...porEntidadMap.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort((a, b) => b.monto - a.monto);

  // Capital que se libera por mes (vencimientos futuros).
  const porMesMap = new Map<string, number>();
  for (const d of proximasLiberaciones) {
    const periodo = d.end_date.slice(0, 7);
    porMesMap.set(periodo, (porMesMap.get(periodo) ?? 0) + d.montoAlVencimiento);
  }
  const porMes = [...porMesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodo, monto]) => ({ periodo, nombre: nombreMes(periodo), monto }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inversiones · DPF</h1>
          <p className="text-sm text-muted-foreground">
            {dpfsActivos} {dpfsActivos === 1 ? "depósito activo" : "depósitos activos"} · {totalHistorico} en total
          </p>
        </div>
        <Link
          href="/tracking/inversiones/dpf/registros"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Ver registros
          <ArrowRight weight="bold" className="size-4" />
        </Link>
      </div>

      {/* Alerta de vencidos */}
      {dpfsVencidos > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <Warning weight="fill" className="size-5 shrink-0 text-destructive" />
          <span>
            Tienes <strong>{dpfsVencidos}</strong> {dpfsVencidos === 1 ? "DPF vencido" : "DPF vencidos"} sin
            marcar como cobrado. Revisa si ya lo liberaste y actualiza su estado.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Vault weight="duotone" className="size-5 text-primary" />}
          label="Capital en DPF"
          valor={formatBob(montoEnDpf)}
        />
        <Kpi
          icon={<TrendUp weight="duotone" className="size-5 text-primary" />}
          label="Ganancia líquida proyectada"
          valor={formatBob(gananciaLiquida)}
          sub={`Bruta ${formatBob(gananciaBruta)} · RC-IVA ${formatBob(rcIva)}`}
        />
        <Kpi
          icon={<Percent weight="duotone" className="size-5 text-muted-foreground" />}
          label="Tasa promedio (ponderada)"
          valor={tasaPromedio == null ? "—" : formatPercent(tasaPromedio, 2)}
          sub={rendimientoNeto == null ? undefined : `Rendimiento neto ${formatPercent(rendimientoNeto, 2)}`}
        />
        <Kpi
          icon={<Bank weight="duotone" className="size-5 text-muted-foreground" />}
          label="Depósitos activos"
          valor={String(dpfsActivos)}
          sub={dpfsVencidos > 0 ? `${dpfsVencidos} vencido(s)` : "Al día"}
          tono={dpfsVencidos > 0 ? "malo" : undefined}
        />
      </div>

      {/* Próximas liberaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck weight="duotone" className="size-5 text-primary" />
            Próximas liberaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximasLiberaciones.length === 0 ? (
            <Vacio texto="No hay DPF activos. Registra el primero desde “Registros”." />
          ) : (
            <div className="space-y-3">
              {proximasLiberaciones.slice(0, 6).map((d) => (
                <FilaLiberacion key={d.id} d={d} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Capital por entidad */}
        <Card>
          <CardHeader>
            <CardTitle>Capital por entidad</CardTitle>
          </CardHeader>
          <CardContent>
            {porEntidad.length === 0 ? (
              <Vacio texto="Sin datos." />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={200} className="max-w-[220px]">
                  <PieChart>
                    <Pie
                      data={porEntidad}
                      dataKey="monto"
                      nameKey="nombre"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {porEntidad.map((_, i) => (
                        <Cell key={i} fill={PALETA[i % PALETA.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBob(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex-1 space-y-1.5">
                  {porEntidad.map((c, i) => (
                    <div key={c.nombre} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: PALETA[i % PALETA.length] }}
                      />
                      <span className="flex-1 truncate">{c.nombre}</span>
                      <span className="w-24 text-right font-medium tabular-nums">{formatBob(c.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vencimientos por mes */}
        <Card>
          <CardHeader>
            <CardTitle>Liberación por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {porMes.length === 0 ? (
              <Vacio texto="Sin vencimientos futuros." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porMes} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(v) => formatBobCompact(v)}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [formatBob(v), "Al vencimiento"]}
                  />
                  <Bar dataKey="monto" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilaLiberacion({ d }: { d: DpfDepositUI }) {
  const { color, texto } = etiquetaLiberacion(d);
  const pct = Math.round(d.progreso * 100);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {d.pizarra || "DPF"}
              {d.id_dpf_externo ? <span className="ml-1 font-normal text-muted-foreground">· {d.id_dpf_externo}</span> : null}
            </span>
            <Badge variant={color}>{texto}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Vence {formatDate(d.end_date)} · {formatPercent(d.annual_rate, 2)} anual
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-primary">{formatBob(d.montoAlVencimiento)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            capital {formatBob(d.principal)}
          </div>
        </div>
      </div>
      {/* Barra de progreso */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${d.liberacion === "vencido" ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {d.diasRestantes < 0
            ? `venció hace ${Math.abs(d.diasRestantes)} d`
            : d.diasRestantes === 0
              ? "vence hoy"
              : `faltan ${d.diasRestantes} d`}
        </span>
      </div>
    </div>
  );
}

export function etiquetaLiberacion(d: DpfDepositUI): {
  color: "success" | "secondary" | "destructive" | "outline";
  texto: string;
} {
  switch (d.liberacion) {
    case "pagado":
      return { color: "secondary", texto: "Cobrado" };
    case "vencido":
      return { color: "destructive", texto: "Vencido" };
    case "por_liberar":
      return { color: "success", texto: "Por liberar" };
    default:
      return { color: "outline", texto: "Activo" };
  }
}

function Kpi({
  icon,
  label,
  valor,
  sub,
  tono,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  sub?: string;
  tono?: "bueno" | "malo";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted/60 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div
            className={`text-lg font-bold tabular-nums ${
              tono === "malo" ? "text-destructive" : tono === "bueno" ? "text-primary" : ""
            }`}
          >
            {valor}
          </div>
          {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex h-[160px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
