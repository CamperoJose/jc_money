"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBob, formatUsd, formatDate } from "@/lib/format";

interface Punto {
  fecha: string;
  bob: number;
  usd: number;
}

export function CurvaPatrimonio({ serie }: { serie: Punto[] }) {
  if (serie.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos de patrimonio todavía.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <LineChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="fecha"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
        />
        <YAxis
          yAxisId="bob"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          stroke="var(--color-border)"
          width={70}
          tickFormatter={(v) => new Intl.NumberFormat("es-BO").format(v)}
        />
        <Tooltip
          labelFormatter={(v) => formatDate(String(v))}
          formatter={(value: number, name) =>
            name === "bob"
              ? [formatBob(value), "Patrimonio (BOB)"]
              : [formatUsd(value), "Patrimonio (USD)"]
          }
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            color: "var(--color-popover-foreground)",
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(v) => (v === "bob" ? "BOB" : "USD")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          yAxisId="bob"
          type="monotone"
          dataKey="bob"
          stroke="var(--color-chart-1)"
          strokeWidth={2.5}
          dot={{ r: 2 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="bob"
          type="monotone"
          dataKey="usd"
          stroke="var(--color-chart-4)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          hide
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
