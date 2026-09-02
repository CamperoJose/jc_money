"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { CurrencyDollar, TrendUp, TrendDown, Bank, ArrowsClockwise } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate, formatPercent } from "@/lib/format";
import { descripcionMoneda } from "@/lib/bcb";
import type { ExchangeRate, TcConfig } from "@/lib/types";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

export function TcClient({
  rates,
  config,
}: {
  rates: ExchangeRate[]; // más reciente primero
  config: TcConfig;
}) {
  const ultimo = rates[0] ?? null;
  const anterior = rates[1] ?? null;
  const variacion =
    ultimo && anterior && anterior.valor
      ? (ultimo.valor - anterior.valor) / anterior.valor
      : null;

  // Serie cronológica ascendente para el gráfico.
  const serie = [...rates]
    .sort((a, b) => a.rate_date.localeCompare(b.rate_date))
    .map((r) => ({ fecha: r.rate_date, valor: r.valor, etiqueta: formatDate(r.rate_date) }));

  const min = serie.length ? Math.min(...serie.map((s) => s.valor)) : 0;
  const max = serie.length ? Math.max(...serie.map((s) => s.valor)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CurrencyDollar weight="duotone" className="size-6 text-primary" />
          Tipo de cambio (BCB)
        </h1>
        <p className="text-sm text-muted-foreground">
          {descripcionMoneda(config.cod_moneda)} · se actualiza solo cada día desde el Banco Central de Bolivia.
        </p>
      </div>

      {rates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <Bank weight="duotone" className="size-8 opacity-60" />
            Aún no hay tipos de cambio registrados. El job diario (00:17 Bolivia) los irá cargando desde el
            BCB. También puedes dispararlo a mano desde GitHub → Actions.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<CurrencyDollar weight="duotone" className="size-5 text-primary" />}
              label="Último T/C"
              valor={`Bs ${formatNumber(ultimo!.valor, 2)}`}
              sub={ultimo ? formatDate(ultimo.rate_date) : undefined}
            />
            <Kpi
              icon={
                (variacion ?? 0) >= 0 ? (
                  <TrendUp weight="duotone" className="size-5 text-primary" />
                ) : (
                  <TrendDown weight="duotone" className="size-5 text-destructive" />
                )
              }
              label="vs. registro anterior"
              valor={variacion == null ? "—" : `${variacion >= 0 ? "+" : ""}${formatPercent(variacion, 2)}`}
            />
            <Kpi
              icon={<ArrowsClockwise weight="duotone" className="size-5 text-muted-foreground" />}
              label="Registros"
              valor={String(rates.length)}
            />
            <Kpi
              icon={<Bank weight="duotone" className="size-5 text-muted-foreground" />}
              label="Rango histórico"
              valor={`${formatNumber(min, 2)}–${formatNumber(max, 2)}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolución del tipo de cambio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradTc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(v) => formatNumber(v, 2)}
                    width={56}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`Bs ${formatNumber(v, 5)}`, "T/C"]} />
                  <Area type="monotone" dataKey="valor" stroke="var(--color-chart-1)" fill="url(#gradTc)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Moneda</th>
                      <th className="px-4 py-2 text-right font-medium">T/C (Bs)</th>
                      <th className="px-4 py-2 font-medium">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id} className="border-b transition-colors hover:bg-muted/40">
                        <td className="px-4 py-2 tabular-nums">{formatDate(r.rate_date)}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.moneda_desc ?? descripcionMoneda(r.cod_moneda)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">
                          {formatNumber(r.valor, 5)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={r.source === "bcb" ? "success" : "secondary"}>
                            {r.source === "bcb" ? "BCB" : r.source}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, valor, sub }: { icon: React.ReactNode; label: string; valor: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted/60 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold tabular-nums">{valor}</div>
          {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
