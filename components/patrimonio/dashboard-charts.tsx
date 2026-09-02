"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatBob, formatUsd, formatDate, formatNumber } from "@/lib/format";
import type { DistribucionCuenta, SerieCuenta } from "@/lib/queries/patrimonio";

// Paleta categórica multi-tono para distinguir cuentas (el tema base solo
// tiene verdes). Legible en claro y oscuro.
const PALETA = [
  "#16a34a", // verde
  "#0891b2", // cian
  "#2563eb", // azul
  "#7c3aed", // violeta
  "#db2777", // rosa
  "#ea580c", // naranja
  "#ca8a04", // ámbar
  "#0d9488", // teal
  "#4f46e5", // índigo
  "#65a30d", // lima
  "#e11d48", // carmín
  "#0284c7", // celeste
];

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

interface Punto {
  fecha: string;
  bob: number;
  usd: number;
  variacion: number | null;
}

/** Evolución del patrimonio con toggle BOB / USD. */
export function EvolucionChart({ serie }: { serie: Punto[] }) {
  const [moneda, setMoneda] = useState<"bob" | "usd">("bob");
  const fmt = moneda === "bob" ? formatBob : formatUsd;

  if (serie.length === 0) {
    return <Vacio />;
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {(["bob", "usd"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMoneda(m)}
            className={
              "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
              (moneda === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent")
            }
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="gradPatri" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={(v) => formatDate(v)}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            width={72}
            tickFormatter={(v) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(v)}
          />
          <Tooltip
            labelFormatter={(v) => formatDate(String(v))}
            formatter={(value: number) => [fmt(value), moneda === "bob" ? "Patrimonio" : "Patrimonio"]}
            contentStyle={tooltipStyle}
          />
          <Area
            type="monotone"
            dataKey={moneda}
            stroke="var(--color-chart-1)"
            strokeWidth={2.5}
            fill="url(#gradPatri)"
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Variación (BOB) foto a foto — barras verdes/rojas. */
export function VariacionChart({ serie }: { serie: Punto[] }) {
  const datos = serie.filter((p) => p.variacion != null);
  if (datos.length === 0) return <Vacio texto="Se necesita más de una foto para ver variaciones." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
          width={72}
          tickFormatter={(v) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(v)}
        />
        <Tooltip
          labelFormatter={(v) => formatDate(String(v))}
          formatter={(value: number) => [formatBob(value), "Variación"]}
          contentStyle={tooltipStyle}
        />
        <ReferenceLine y={0} stroke="var(--color-border)" />
        <Bar dataKey="variacion" radius={[3, 3, 0, 0]}>
          {datos.map((p, i) => (
            <Cell
              key={i}
              fill={(p.variacion ?? 0) >= 0 ? "var(--color-chart-2)" : "var(--color-destructive)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Distribución por cuenta (última foto) — donut + leyenda. */
export function DistribucionCuentasChart({ cuentas }: { cuentas: DistribucionCuenta[] }) {
  const activos = cuentas.filter((c) => !c.is_liability && c.montoBob > 0);
  if (activos.length === 0) return <Vacio />;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <ResponsiveContainer width="100%" height={240} className="max-w-[260px]">
        <PieChart>
          <Pie
            data={activos}
            dataKey="montoBob"
            nameKey="nombre"
            innerRadius={58}
            outerRadius={100}
            paddingAngle={2}
            stroke="var(--color-card)"
            strokeWidth={2}
          >
            {activos.map((_, i) => (
              <Cell key={i} fill={PALETA[i % PALETA.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _n, p) => [
              formatBob(value),
              (p?.payload as DistribucionCuenta)?.nombre ?? "",
            ]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full flex-1 space-y-2.5">
        {activos.map((c, i) => {
          const color = PALETA[i % PALETA.length];
          return (
            <li key={c.account_id} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="size-3 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="truncate font-medium">{c.nombre}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatNumber(c.pct * 100, 1)}%
                </span>
                <span className="w-28 shrink-0 text-right tabular-nums font-semibold">
                  {formatBob(c.montoBob)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(c.pct * 100, 1.5)}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Timeline de crecimiento por cuenta (una línea por cuenta, valores en BOB). */
export function CrecimientoCuentasChart({
  cuentas,
  puntos,
}: {
  cuentas: SerieCuenta[];
  puntos: Array<Record<string, number | string | null>>;
}) {
  // Orden por magnitud del último valor, para que la leyenda tenga sentido.
  const ordenadas = [...cuentas].sort((a, b) => {
    const ult = puntos.at(-1) ?? {};
    return Number(ult[b.key] ?? 0) - Number(ult[a.key] ?? 0);
  });
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  if (puntos.length < 2) {
    return <Vacio texto="Se necesitan al menos dos fotos para ver el crecimiento por cuenta." />;
  }

  const colorDe = (key: string) => PALETA[ordenadas.findIndex((c) => c.key === key) % PALETA.length];

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={puntos} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={(v) => formatDate(String(v))}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            stroke="var(--color-border)"
            width={64}
            tickFormatter={(v) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(v)}
          />
          <Tooltip
            labelFormatter={(v) => formatDate(String(v))}
            formatter={(value: number, key) => [
              formatBob(value),
              ordenadas.find((c) => c.key === key)?.nombre ?? key,
            ]}
            contentStyle={tooltipStyle}
            itemSorter={(item) => -(item.value as number)}
          />
          {ordenadas.map((c) => (
            <Line
              key={c.key}
              type="monotone"
              dataKey={c.key}
              stroke={colorDe(c.key)}
              strokeWidth={2}
              strokeDasharray={c.is_liability ? "4 3" : undefined}
              dot={{ r: 1.5 }}
              activeDot={{ r: 4 }}
              connectNulls
              hide={ocultas.has(c.key)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {ordenadas.map((c) => {
          const off = ocultas.has(c.key);
          return (
            <button
              key={c.key}
              onClick={() =>
                setOcultas((prev) => {
                  const next = new Set(prev);
                  if (next.has(c.key)) next.delete(c.key);
                  else next.add(c.key);
                  return next;
                })
              }
              className={
                "flex items-center gap-1.5 text-xs font-medium transition-opacity " +
                (off ? "opacity-40" : "opacity-100")
              }
            >
              <span className="size-2.5 rounded-full" style={{ background: colorDe(c.key) }} />
              {c.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Vacio({ texto = "Sin datos todavía." }: { texto?: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}
