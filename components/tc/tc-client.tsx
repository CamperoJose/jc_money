"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { useAvisos } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/tremor/kpi-card";
import { conTs, rangoEnDias, propsEjeTiempo, formatoFechaTooltip } from "@/lib/charts";
import { usePreferencia } from "@/lib/hooks/preferencia";
import {
  SelectorRango,
  recortarPorRango,
  IDS_RANGO,
  type RangoId,
} from "@/components/tremor/selector-rango";
import {
  TableRoot,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/tremor/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate, formatPercent } from "@/lib/format";
import { PronosticoTc } from "@/components/tc/pronostico-tc";
import type { ResultadoPronostico } from "@/lib/pronostico";
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
  pronostico,
}: {
  rates: ExchangeRate[]; // más reciente primero
  config: TcConfig;
  pronostico: ResultadoPronostico | null;
}) {
  const router = useRouter();
  const avisos = useAvisos();
  const [actualizando, setActualizando] = useState(false);
  const [rango, setRango] = usePreferencia<RangoId>("tc.rango", "todo", IDS_RANGO as RangoId[]);

  async function actualizarTc() {
    if (actualizando) return;
    setActualizando(true);
    try {
      const res = await fetch("/api/tc/actualizar", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const valor = Number(data.resultado?.valor);
      avisos.exito(
        "Tipo de cambio actualizado",
        Number.isFinite(valor)
          ? `Nuevo T/C global: Bs ${formatNumber(valor, 5)}`
          : "La cotización global se actualizó correctamente."
      );
      router.refresh();
    } catch (e) {
      avisos.error(
        "No se pudo actualizar el T/C",
        e instanceof Error ? e.message : "Error inesperado."
      );
    } finally {
      setActualizando(false);
    }
  }
  const ultimo = rates[0] ?? null;
  const anterior = rates[1] ?? null;
  const variacion =
    ultimo && anterior && anterior.valor
      ? (ultimo.valor - anterior.valor) / anterior.valor
      : null;

  // Serie cronológica ascendente para el gráfico.
  const serie = [...rates]
    .sort((a, b) => a.rate_date.localeCompare(b.rate_date))
    // Los registros de T/C son irregulares: el eje debe ser de tiempo, no
    // categórico, o meses sin registro se ven como un solo paso.
    .map((r) => ({ fecha: r.rate_date, valor: r.valor }));
  const serieTs = recortarPorRango(conTs(serie), rango);
  const rangoTc = rangoEnDias(serieTs.map((p) => p.ts));

  const min = serie.length ? Math.min(...serie.map((s) => s.valor)) : 0;
  const max = serie.length ? Math.max(...serie.map((s) => s.valor)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CurrencyDollar weight="duotone" className="size-6 text-primary" />
            Tipo de cambio (Binance P2P)
          </h1>
          <p className="text-sm text-muted-foreground">
            BOB/USDT · referencia diaria calculada con la mediana de compradores en Binance P2P.
          </p>
        </div>

        <Button onClick={actualizarTc} disabled={actualizando} className="shrink-0">
          <ArrowsClockwise
            weight="bold"
            className={`size-4 ${actualizando ? "animate-spin" : ""}`}
          />
          {actualizando ? "Actualizando…" : "Actualizar TC"}
        </Button>
      </div>

      {rates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <Bank weight="duotone" className="size-8 opacity-60" />
            Aún no hay tipos de cambio registrados. El job diario (00:17 Bolivia) los irá cargando desde
            Binance P2P. También puedes dispararlo a mano desde GitHub → Actions.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              etiqueta="Último T/C"
              valor={`Bs ${formatNumber(ultimo!.valor, 2)}`}
              detalle={ultimo ? `Registrado el ${formatDate(ultimo.rate_date)}` : undefined}
              icono={<CurrencyDollar weight="duotone" className="size-4" />}
            />
            <Kpi
              etiqueta="vs. registro anterior"
              valor={variacion == null ? "—" : `${variacion >= 0 ? "+" : ""}${formatPercent(variacion, 2)}`}
              detalle={variacion == null ? "Sin comparación" : variacion >= 0 ? "El dólar subió" : "El dólar bajó"}
              icono={
                (variacion ?? 0) >= 0 ? (
                  <TrendUp weight="duotone" className="size-4" />
                ) : (
                  <TrendDown weight="duotone" className="size-4" />
                )
              }
              tono={variacion == null ? "neutral" : variacion >= 0 ? "pos" : "neg"}
            />
            <Kpi
              etiqueta="Registros"
              valor={String(rates.length)}
              detalle="Histórico diario almacenado"
              icono={<ArrowsClockwise weight="duotone" className="size-4" />}
            />
            <Kpi
              etiqueta="Rango histórico"
              valor={`${formatNumber(min, 2)}–${formatNumber(max, 2)}`}
              detalle={`Amplitud ${formatNumber(max - min, 4)} Bs`}
              icono={<Bank weight="duotone" className="size-4" />}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle>Evolución del tipo de cambio</CardTitle>
              <SelectorRango valor={rango} onChange={setRango} />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart accessibilityLayer data={serieTs} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradTc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis {...propsEjeTiempo(rangoTc)} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(v) => formatNumber(v, 2)}
                    width={56}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatoFechaTooltip(Number(v))} formatter={(v: number) => [`Bs ${formatNumber(v, 5)}`, "T/C"]} />
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
                <TableRoot>
                  <Table>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                      <TableRow className="hover:bg-transparent">
                        <TableHeaderCell>Fecha</TableHeaderCell>
                        <TableHeaderCell>Moneda</TableHeaderCell>
                        <TableHeaderCell className="text-right">T/C (Bs)</TableHeaderCell>
                        <TableHeaderCell className="text-right">Variación</TableHeaderCell>
                        <TableHeaderCell>Origen</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rates.map((r, i) => {
                        // rates viene del más reciente al más antiguo: el anterior es el siguiente.
                        const previo = rates[i + 1];
                        const delta = previo ? r.valor - previo.valor : null;
                        const deltaPct = previo && previo.valor ? (r.valor - previo.valor) / previo.valor : null;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {formatDate(r.rate_date)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.moneda_desc ?? (r.cod_moneda === 12 ? "USD/USDT" : `Moneda ${r.cod_moneda}`)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatNumber(r.valor, 5)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {delta == null || Math.abs(delta) < 1e-9 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className={delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                                  {delta > 0 ? "▲" : "▼"} {formatNumber(Math.abs(delta), 4)}
                                  {deltaPct != null && (
                                    <span className="ml-1 text-xs opacity-80">
                                      ({formatPercent(Math.abs(deltaPct), 2)})
                                    </span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.source === "binance_p2p_median" ? "success" : "neutral"}>
                                {r.source === "binance_p2p_median"
                                  ? "Binance P2P · mediana"
                                  : r.source === "bcb"
                                    ? "BCB (histórico)"
                                    : r.source}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableRoot>
              </div>
            </CardContent>
          </Card>

          {/* Mini-dashboard de pronóstico, al final: primero los hechos, después
              la proyección. Al revés se lee la estimación como si fuera un dato. */}
          {pronostico && <PronosticoTc p={pronostico} historico={serie} />}
        </>
      )}
    </div>
  );
}

