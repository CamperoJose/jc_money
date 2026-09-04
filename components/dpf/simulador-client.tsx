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
import { Kpi } from "@/components/tremor/kpi-card";
import {
  TableRoot,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableFoot,
} from "@/components/tremor/table";
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
  const [cadenciaMeses, setCadenciaMeses] = useState("1");
  const [plazoMeses, setPlazoMeses] = useState("3");
  const [tasa, setTasa] = useState("7.7");
  const [periodos, setPeriodos] = useState("24");
  const [reinvertir, setReinvertir] = useState("si");
  const [cobraIva, setCobraIva] = useState("no");
  const [fechaInicio, setFechaInicio] = useState(hoyInput());

  const params: ParamsSimulador = useMemo(
    () => ({
      montoInicial: Math.max(0, parseFloat(montoInicial) || 0),
      aportePeriodico: Math.max(0, parseFloat(aportePeriodico) || 0),
      cadenciaMeses: Math.max(1, parseInt(cadenciaMeses, 10) || 1),
      plazoMeses: Math.max(1, parseInt(plazoMeses, 10) || 3),
      tasaAnual: Math.max(0, (parseFloat(tasa) || 0) / 100),
      periodos: Math.max(1, Math.min(240, parseInt(periodos, 10) || 12)),
      reinvertirInteres: reinvertir === "si",
      cobraIva: cobraIva === "si",
      fechaInicio,
    }),
    [montoInicial, aportePeriodico, cadenciaMeses, plazoMeses, tasa, periodos, reinvertir, cobraIva, fechaInicio]
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
              <Campo label="Cada (meses)">
                <Input type="number" min="1" step="1" value={cadenciaMeses} onChange={(e) => setCadenciaMeses(e.target.value)} />
              </Campo>
              <Campo label="Plazo (meses)">
                <Input type="number" min="1" step="1" value={plazoMeses} onChange={(e) => setPlazoMeses(e.target.value)} />
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
            <Campo label="¿Cobra IVA (RC-IVA 13%)?">
              <Select value={cobraIva} onChange={(e) => setCobraIva(e.target.value)}>
                <option value="no">No (sin retención)</option>
                <option value="si">Sí (retiene 13%)</option>
              </Select>
            </Campo>
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi etiqueta="Aportado (fresco)" valor={formatBob(r.aportadoTotal)} detalle="Dinero nuevo que pusiste" icono={<Coins weight="duotone" className="size-4" />} />
            <Kpi etiqueta="Interés líquido total" valor={formatBob(r.interesLiquidoTotal)} detalle={`RC-IVA retenido ${formatBob(r.rcIvaTotal)}`} icono={<TrendUp weight="duotone" className="size-4" />} tono="pos" />
            <Kpi etiqueta="Valor final" valor={formatBob(r.valorFinal)} detalle={`Capital activo ${formatBobCompact(r.capitalFinalActivo)}`} icono={<Stack weight="duotone" className="size-4" />} tono="pos" />
            <Kpi etiqueta="Rendimiento s/ aportado" valor={r.tasaEfectiva == null ? "—" : formatPercent(r.tasaEfectiva, 2)} detalle={`Horizonte de ${r.duracionDias} días`} icono={<Percent weight="duotone" className="size-4" />} />
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
                <TableRoot>
                  <Table>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                      <TableRow className="hover:bg-transparent">
                        <TableHeaderCell>#</TableHeaderCell>
                        <TableHeaderCell>Apertura</TableHeaderCell>
                        <TableHeaderCell className="text-right">Aporte</TableHeaderCell>
                        <TableHeaderCell className="text-right">Liberado</TableHeaderCell>
                        <TableHeaderCell className="text-right">Nuevo DPF</TableHeaderCell>
                        <TableHeaderCell className="text-right">Int. líquido</TableHeaderCell>
                        <TableHeaderCell className="text-right">Int. acumulado</TableHeaderCell>
                        <TableHeaderCell className="text-right">Capital activo</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        let acumulado = 0;
                        return r.filas.map((f) => {
                          acumulado += f.interesLiquido;
                          return (
                            <TableRow key={f.periodo} className="tabular-nums">
                              <TableCell className="text-muted-foreground">{f.periodo}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {formatDate(f.fecha)}
                              </TableCell>
                              <TableCell className="text-right">{formatBob(f.aporteFresco)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatBob(f.liberadoCapital)}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatBob(f.principal)}</TableCell>
                              <TableCell className="text-right text-primary">{formatBob(f.interesLiquido)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatBob(acumulado)}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatBob(f.capitalActivo)}</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                    <TableFoot>
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={2} className="font-semibold">
                          {r.filas.length} {r.filas.length === 1 ? "periodo" : "periodos"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatBob(r.aportadoTotal)}
                        </TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right font-semibold tabular-nums text-primary">
                          {formatBob(r.interesLiquidoTotal)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatBob(r.valorFinal)}
                        </TableCell>
                      </TableRow>
                    </TableFoot>
                  </Table>
                </TableRoot>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Interés bruto = capital · tasa · (meses/12). Interés líquido = bruto{" "}
            {cobraIva === "si" ? "· 0,87 (retención RC-IVA 13%)" : "(sin retención de IVA)"}. El
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

