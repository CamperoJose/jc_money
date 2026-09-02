"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Coins, TrendUp, Percent, Stack, Flask } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatBob, formatBobCompact, formatPercent, formatDate } from "@/lib/format";
import { simularLaddering, type ParamsSimulador } from "@/lib/dpf";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

function hoyInput(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function SimuladorClient() {
  const [montoInicial, setMontoInicial] = useState("10000");
  const [aportePeriodico, setAportePeriodico] = useState("2000");
  const [cadenciaDias, setCadenciaDias] = useState("30");
  const [plazoDias, setPlazoDias] = useState("90");
  const [tasa, setTasa] = useState("7.7");
  const [periodos, setPeriodos] = useState("24");
  const [reinvertir, setReinvertir] = useState("si");
  const [fechaInicio, setFechaInicio] = useState(hoyInput());

  const params: ParamsSimulador = useMemo(
    () => ({
      montoInicial: Math.max(0, parseFloat(montoInicial) || 0),
      aportePeriodico: Math.max(0, parseFloat(aportePeriodico) || 0),
      cadenciaDias: Math.max(1, parseInt(cadenciaDias, 10) || 30),
      plazoDias: Math.max(1, parseInt(plazoDias, 10) || 90),
      tasaAnual: Math.max(0, (parseFloat(tasa) || 0) / 100),
      periodos: Math.max(1, Math.min(240, parseInt(periodos, 10) || 12)),
      reinvertirInteres: reinvertir === "si",
      fechaInicio,
    }),
    [montoInicial, aportePeriodico, cadenciaDias, plazoDias, tasa, periodos, reinvertir, fechaInicio]
  );

  const r = useMemo(() => simularLaddering(params), [params]);

  const dataChart = r.filas.map((f) => ({
    nombre: `P${f.periodo}`,
    capitalActivo: f.capitalActivo,
    aportado: f.aportadoAcumulado,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Flask weight="duotone" className="size-6 text-primary" />
          Simulador de DPF (laddering)
        </h1>
        <p className="text-sm text-muted-foreground">
          Proyecta una escalera de depósitos reinvirtiendo el capital que se libera. Nada de esto se guarda ni afecta tu patrimonio.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Panel de parámetros */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Parámetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <Campo label="Capital inicial (Bs)">
              <Input type="number" min="0" step="100" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} />
            </Campo>
            <Campo label="Aporte por periodo (Bs)">
              <Input type="number" min="0" step="100" value={aportePeriodico} onChange={(e) => setAportePeriodico(e.target.value)} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Cada (días)">
                <Input type="number" min="1" step="1" value={cadenciaDias} onChange={(e) => setCadenciaDias(e.target.value)} />
              </Campo>
              <Campo label="Plazo (días)">
                <Input type="number" min="1" step="1" value={plazoDias} onChange={(e) => setPlazoDias(e.target.value)} />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tasa anual (%)">
                <Input type="number" min="0" step="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)} />
              </Campo>
              <Campo label="Nº de aportes">
                <Input type="number" min="1" max="240" step="1" value={periodos} onChange={(e) => setPeriodos(e.target.value)} />
              </Campo>
            </div>
            <Campo label="Fecha de inicio">
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </Campo>
            <Campo label="Reinvertir interés al vencer">
              <Select value={reinvertir} onChange={(e) => setReinvertir(e.target.value)}>
                <option value="si">Sí (interés compuesto)</option>
                <option value="no">No (solo capital)</option>
              </Select>
            </Campo>
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<Coins weight="duotone" className="size-5 text-muted-foreground" />} label="Aportado (fresco)" valor={formatBob(r.aportadoTotal)} />
            <Kpi icon={<TrendUp weight="duotone" className="size-5 text-primary" />} label="Interés líquido total" valor={formatBob(r.interesLiquidoTotal)} sub={`RC-IVA ${formatBob(r.rcIvaTotal)}`} />
            <Kpi icon={<Stack weight="duotone" className="size-5 text-primary" />} label="Valor final" valor={formatBob(r.valorFinal)} sub={`Capital activo ${formatBobCompact(r.capitalFinalActivo)}`} />
            <Kpi icon={<Percent weight="duotone" className="size-5 text-muted-foreground" />} label="Rendimiento s/ aportado" valor={r.tasaEfectiva == null ? "—" : formatPercent(r.tasaEfectiva, 2)} sub={`${r.duracionDias} días`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Crecimiento del capital</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dataChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradCapital" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => formatBobCompact(v)} width={70} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, n) => [formatBob(v), n === "capitalActivo" ? "Capital activo" : "Aportado"]}
                  />
                  <Legend formatter={(v) => (v === "capitalActivo" ? "Capital activo" : "Aportado")} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="capitalActivo" stroke="var(--color-chart-1)" fill="url(#gradCapital)" strokeWidth={2} />
                  <Line type="monotone" dataKey="aportado" stroke="var(--color-muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Detalle por periodo</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Apertura</th>
                      <th className="px-3 py-2 text-right font-medium">Aporte</th>
                      <th className="px-3 py-2 text-right font-medium">Liberado</th>
                      <th className="px-3 py-2 text-right font-medium">Nuevo DPF</th>
                      <th className="px-3 py-2 text-right font-medium">Int. líq.</th>
                      <th className="px-3 py-2 text-right font-medium">Capital activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.filas.map((f) => (
                      <tr key={f.periodo} className="border-b tabular-nums transition-colors hover:bg-muted/40">
                        <td className="px-3 py-1.5 text-muted-foreground">{f.periodo}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{formatDate(f.fecha)}</td>
                        <td className="px-3 py-1.5 text-right">{formatBob(f.aporteFresco)}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">{formatBob(f.liberadoCapital)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{formatBob(f.principal)}</td>
                        <td className="px-3 py-1.5 text-right text-primary">{formatBob(f.interesLiquido)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{formatBob(f.capitalActivo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Interés bruto = capital · tasa · plazo/365. Interés líquido = bruto · 0,87 (retención RC-IVA 13%). El
            simulador asume que cada depósito se renueva con el capital liberado más el aporte del periodo.
          </p>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
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
