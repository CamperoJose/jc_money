"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarBlank,
  ChartLineUp,
  Wallet,
  Target,
} from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kpi } from "@/components/tremor/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderCellOrdenable,
  TableRoot,
  TableRow,
} from "@/components/tremor/table";
import { useOrden, usePaginacion } from "@/lib/hooks/tabla";
import { useFiltrosUrl } from "@/lib/hooks/estado-url";
import {
  conTs,
  formatoFechaTooltip,
  propsEjeTiempo,
  rangoEnDias,
  tsDeFecha,
} from "@/lib/charts";
import {
  formatBob,
  formatBobCompact,
  formatDate,
  formatEje,
  formatNumber,
} from "@/lib/format";
import {
  aplicarEscenario,
  type AperturaMensual,
  type ProyeccionPatrimonio,
} from "@/lib/proyeccion-patrimonio";
import type { PuntoTendencia } from "@/lib/tendencias";
import { cn } from "@/lib/utils";

function numero(texto: string, minimo: number, maximo: number): number {
  const n = Number(texto);
  return Number.isFinite(n) ? Math.max(minimo, Math.min(maximo, n)) : 0;
}
const signo = (n: number) => `${n >= 0 ? "+" : ""}${formatBob(n)}`;
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-popover-foreground)",
  fontSize: 12,
};

export function ProyeccionMensual({
  p,
  historico,
}: {
  p: ProyeccionPatrimonio;
  historico: PuntoTendencia[];
}) {
  const { obtener, asignar } = useFiltrosUrl();
  const extra = numero(obtener("ahorro", "0"), -1_000_000, 1_000_000);
  const tc = numero(obtener("tc", "0"), -90, 100);
  const meses = [3, 6, 12].includes(Number(obtener("meses", "12")))
    ? Number(obtener("meses", "12"))
    : 12;
  const filas = useMemo(
    () => aplicarEscenario(p, extra, tc).slice(0, meses),
    [p, extra, tc, meses],
  );
  const { ordenadas, orden, ordenarPor } = useOrden(filas, {
    fecha: (a) => a.fecha,
    patrimonio: (a) => a.patrimonio,
    cambio: (a) => a.cambio,
    flujos: (a) => a.patrimonioPorFlujos,
    disponible: (a) => a.disponiblePorFlujos,
  });
  const pag = usePaginacion(ordenadas, 12);
  const objetivo = numero(
    obtener(
      "meta",
      String(Math.ceil(((p.base?.bob ?? 0) + 10000) / 10000) * 10000),
    ),
    1,
    1_000_000_000,
  );
  const logro = filas.find((a) => a.patrimonio >= objetivo);
  const escenario = extra !== 0 || tc !== 0;
  const primera = filas[0];
  const ultima = filas.at(-1);
  const chart = useMemo(() => {
    // Un año de histórico para conservar legibilidad; el modelo usa todo su
    // historial disponible. El selector cambia solo el horizonte mostrado.
    const reales = historico
      .filter(
        (a) =>
          a.real != null &&
          p.base &&
          a.fecha <= p.base.fecha &&
          a.fecha >= `${Number(p.hoy.slice(0, 4)) - 1}${p.hoy.slice(4)}`,
      )
      .map((a) => ({
        fecha: a.fecha,
        real: a.real,
        base: null as number | null,
        escenario: null as number | null,
        banda: null as [number, number] | null,
      }));
    if (p.base) {
      const actual = {
        fecha: p.base.fecha,
        real: p.base.bob,
        base: p.base.bob,
        escenario: p.base.bob,
        banda: null,
      };
      if (reales.at(-1)?.fecha === actual.fecha)
        reales[reales.length - 1] = actual;
      else reales.push(actual);
    }
    return conTs([
      ...reales,
      ...filas.map((a, i) => ({
        fecha: a.fecha,
        real: null,
        base: p.aperturas[i].patrimonio,
        escenario: a.patrimonio,
        banda: a.rango,
      })),
    ]);
  }, [historico, p, filas]);

  if (!p.base || !primera)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Registra tu patrimonio para proyectar las próximas aperturas
          mensuales.
        </CardContent>
      </Card>
    );

  return (
    <>
      <Card className="trama-rejilla resplandor">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CalendarBlank className="size-5 shrink-0" weight="duotone" /> Tu
              próximo día 1 · {formatDate(primera.fecha)}
            </div>
            <div className="break-words text-[clamp(1.7rem,1.2rem+2vw,2.6rem)] font-bold tabular-nums text-primary">
              {formatBob(primera.patrimonio)}
            </div>
            <p className="text-sm text-muted-foreground">
              Patrimonio estimado ·{" "}
              <span
                className={
                  primera.cambio < 0 ? "text-destructive" : "text-primary"
                }
              >
                {signo(primera.cambio)}
              </span>{" "}
              desde la base.
            </p>
            {primera.rango && (
              <p className="text-xs text-muted-foreground">
                Rango orientativo: {formatBob(primera.rango[0])} a{" "}
                {formatBob(primera.rango[1])}
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Apertura del mes en Bolivia: equivale al cierre del día anterior.
              La base incluye lo registrado hasta el {formatDate(p.base.fecha)};
              no anticipa más movimientos de ese día ni los del día 1.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border bg-background/60 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Base {p.base.enVivo ? "actualizada" : "histórica"}
              </span>
              <strong className="text-sm tabular-nums">
                {formatBob(p.base.bob)}
              </strong>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Dinero disponible en la base
              </span>
              <strong className="text-sm tabular-nums">
                {formatBob(p.base.disponible)}
              </strong>
            </div>
            <div className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
              {p.modelo.nombre}.{" "}
              {p.modelo.validado
                ? "Elegido por su error en cierres posteriores."
                : "Provisional: aún sin validación suficiente."}
              {escenario ? " Incluye tus supuestos de escenario." : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Explora tu escenario</CardTitle>
          <CardDescription>
            Compara la tendencia con un cambio de ahorro y de cotización. Estos
            supuestos se guardan en la URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={`${extra}:${tc}`}
            className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              asignar({
                ahorro: String(
                  numero(String(f.get("ahorro")), -1_000_000, 1_000_000),
                ),
                tc: String(numero(String(f.get("tc")), -90, 100)),
              });
            }}
          >
            <label className="space-y-1.5 text-sm">
              <span>Ahorro adicional al mes (Bs)</span>
              <Input
                name="ahorro"
                type="number"
                inputMode="decimal"
                min={-1000000}
                max={1000000}
                step="0.01"
                defaultValue={extra}
              />
              <span className="block text-xs text-muted-foreground">
                Negativo si gastarías más.
              </span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Cambio del T/C (%)</span>
              <Input
                name="tc"
                type="number"
                inputMode="decimal"
                min={-90}
                max={100}
                step="0.1"
                defaultValue={tc}
                disabled={p.base.rate == null || p.base.exposicion === 0}
              />
              <span className="block text-xs text-muted-foreground">
                Sobre tu saldo neto actual USD y USDT.
              </span>
            </label>
            <Button type="submit">Comparar escenario</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!escenario}
              onClick={() => asignar({ ahorro: null, tc: null })}
            >
              Restablecer supuestos
            </Button>
          </form>
          {escenario && (
            <p
              className="mt-4 text-sm text-muted-foreground"
              aria-live="polite"
            >
              Al {formatDate(ultima?.fecha)}, el escenario cambia el patrimonio
              en{" "}
              <strong className="text-foreground">
                {signo(
                  (ultima?.patrimonio ?? 0) -
                    p.aperturas[filas.length - 1].patrimonio,
                )}
              </strong>
              . El ahorro se distribuye por días; el cambio de T/C se aplica una
              vez a la exposición actual y se mantiene.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Patrimonio al día 1 de cada mes</CardTitle>
            <div
              className="flex gap-1 rounded-lg border p-1"
              role="group"
              aria-label="Horizonte de proyección"
            >
              {[3, 6, 12].map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={meses === m ? "default" : "ghost"}
                  aria-pressed={meses === m}
                  onClick={() => asignar({ meses: String(m) })}
                >
                  {m} meses
                </Button>
              ))}
            </div>
          </div>
          <CardDescription>
            Histórico del último año y aperturas futuras. El horizonte visible
            no cambia el entrenamiento del modelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                accessibilityLayer
                data={chart}
                margin={{ top: 16, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  {...propsEjeTiempo(rangoEnDias(chart.map((a) => a.ts)))}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickFormatter={formatEje}
                  width={52}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(l) => formatoFechaTooltip(Number(l))}
                  formatter={(v: number | [number, number], n) =>
                    Array.isArray(v)
                      ? [
                          `${formatBob(v[0])} – ${formatBob(v[1])}`,
                          "Rango orientativo",
                        ]
                      : [
                          formatBob(v),
                          n === "real"
                            ? "Histórico / base"
                            : n === "base"
                              ? "Tendencia base"
                              : "Tu escenario",
                        ]
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) =>
                    v === "real"
                      ? "Histórico / base"
                      : v === "base"
                        ? "Tendencia base"
                        : v === "banda"
                          ? "Rango orientativo"
                          : "Tu escenario"
                  }
                />
                <ReferenceLine
                  x={tsDeFecha(p.base.fecha)}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 3"
                  label={{
                    value: "Base",
                    position: "top",
                    fontSize: 10,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <ReferenceLine y={0} stroke="var(--color-border)" />
                <Area
                  type="linear"
                  dataKey="banda"
                  stroke="none"
                  fill="var(--color-chart-3)"
                  fillOpacity={0.12}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="real"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  connectNulls
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="base"
                  stroke="var(--color-chart-3)"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                {escenario && (
                  <Line
                    type="linear"
                    dataKey="escenario"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Las fechas lejanas son extrapolaciones. El rango usa el mayor error
            absoluto de los cierres evaluados, ampliado según el horizonte; no
            representa una certeza del 95%.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aperturas mensuales en detalle</CardTitle>
          <CardDescription>
            La estimación por flujos es una alternativa a la tendencia. No se
            suman entre sí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden lg:block">
            <TableRoot
              altoMaximo="32rem"
              aria-label="Proyección de aperturas mensuales"
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCellOrdenable
                      campo="fecha"
                      orden={orden}
                      onOrdenar={ordenarPor}
                    >
                      Día 1
                    </TableHeaderCellOrdenable>
                    <TableHeaderCellOrdenable
                      campo="patrimonio"
                      orden={orden}
                      onOrdenar={ordenarPor}
                      className="text-right"
                    >
                      Patrimonio
                    </TableHeaderCellOrdenable>
                    <TableHeaderCellOrdenable
                      campo="cambio"
                      orden={orden}
                      onOrdenar={ordenarPor}
                      className="text-right"
                    >
                      Cambio desde la base
                    </TableHeaderCellOrdenable>
                    <TableHeaderCellOrdenable
                      campo="flujos"
                      orden={orden}
                      onOrdenar={ordenarPor}
                      className="text-right"
                    >
                      Por flujos
                    </TableHeaderCellOrdenable>
                    <TableHeaderCellOrdenable
                      campo="disponible"
                      orden={orden}
                      onOrdenar={ordenarPor}
                      className="text-right"
                    >
                      Disponible por flujos*
                    </TableHeaderCellOrdenable>
                    <TableHeaderCell className="text-right">
                      Capital previsto**
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pag.pagina.map((a) => (
                    <TableRow key={a.fecha}>
                      <TableCell>
                        <div className="whitespace-nowrap font-medium">
                          {formatDate(a.fecha)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.extrapolacion
                            ? "Extrapolación"
                            : "Horizonte cercano"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-semibold">
                          {formatBob(a.patrimonio)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.rango
                            ? `${formatBobCompact(a.rango[0])} – ${formatBobCompact(a.rango[1])}`
                            : "Sin rango validado"}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          a.cambio < 0 ? "text-destructive" : "text-primary",
                        )}
                      >
                        <div>{signo(a.cambio)}</div>
                        <div className="text-xs text-muted-foreground">
                          {signo(a.cambioPeriodo)} en el periodo
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBob(a.patrimonioPorFlujos)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          (a.disponiblePorFlujos ?? 0) < 0 &&
                            "text-destructive",
                        )}
                      >
                        {formatBob(a.disponiblePorFlujos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div>{formatBob(a.capitalDpf)} DPF</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBob(a.porCobrar)} por cobrar
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableRoot>
          </div>
          <div className="grid gap-3 lg:hidden">
            {pag.pagina.map((a) => (
              <AperturaCard key={a.fecha} a={a} />
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            * Disponible por flujos: supone que el ahorro neto se queda en
            efectivo, banco o stablecoins. No incluye reinversiones, cobros
            previstos ni el shock de T/C del escenario. Puede ser negativo si
            faltaría liquidez.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            ** Capital de DPF y deudas que vencen en cada periodo. Son recursos
            potenciales, sujetos a cobro: no se suman al patrimonio ni al
            disponible estimado. El capital ya pertenece a tu patrimonio. Se
            excluyen intereses y vencimientos atrasados.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta={p.flujos.ingresoEstimadoSnapshots != null ? "Ingreso mensual estimado" : "Ingreso mensual registrado"}
          valor={formatBobCompact(p.flujos.ingresoEstimadoSnapshots ?? p.flujos.ingresoMensual)}
          detalle={p.flujos.ingresoEstimadoSnapshots != null ? "Cambio de saldos + gastos registrados" : "Promedio de meses cerrados utilizables"}
          icono={<Wallet className="size-4" weight="duotone" />}
        />
        <Kpi
          etiqueta="Gasto mensual registrado"
          valor={formatBobCompact(p.flujos.gastoReferenciaSnapshots ?? p.flujos.gastoMensual)}
          detalle={p.flujos.gastoReferenciaSnapshots != null ? "Promedio en meses con snapshots comparables" : "Incluye gastos fijos y variables, una sola vez"}
          icono={<Wallet className="size-4" weight="duotone" />}
        />
        <Kpi
          etiqueta={p.flujos.variacionSaldoSnapshots != null ? "Variación neta en snapshots" : "Ahorro neto registrado"}
          valor={formatBobCompact(p.flujos.variacionSaldoSnapshots ?? p.flujos.netoMensual)}
          detalle={p.flujos.variacionSaldoSnapshots != null ? "Cambio mensual combinado de saldos por cuenta" : "Ingresos menos gastos registrados"}
          tono={(p.flujos.variacionSaldoSnapshots ?? p.flujos.netoMensual ?? 0) >= 0 ? "pos" : "neg"}
          icono={<ChartLineUp className="size-4" weight="duotone" />}
        />
        <Kpi
          etiqueta="Diferencia entre ritmos"
          valor={formatBobCompact(p.diferenciaRitmos)}
          detalle="Tendencia menos ahorro: no equivale a rentabilidad"
          icono={<ChartLineUp className="size-4" weight="duotone" />}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lectura mensual de tus cuentas</CardTitle>
          <CardDescription>
            Estimación orientativa basada en cambios de saldo entre snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          {p.flujos.ingresoEstimadoSnapshots != null && p.flujos.gastoReferenciaSnapshots != null ? (
            <p>
              Parece que cada mes ingresas aproximadamente{" "}
              <strong>{formatBob(p.flujos.ingresoEstimadoSnapshots)}</strong> y
              gastas <strong>{formatBob(p.flujos.gastoReferenciaSnapshots)}</strong>.
              El ingreso se estima con la variación conjunta de los saldos por
              cuenta más los gastos registrados en esos mismos meses.
            </p>
          ) : p.flujos.variacionSaldoSnapshots != null ? (
            <p>
              Tus snapshots muestran que el saldo combinado de tus cuentas
              cambió en promedio{" "}
              <strong>{formatBob(p.flujos.variacionSaldoSnapshots)}</strong> al
              mes. Todavía no hay dos meses con snapshots y movimientos
              coincidentes para estimar por separado ingresos y gastos.
            </p>
          ) : (
            <p>
              Todavía no hay suficientes snapshots mensuales comparables para
              estimar la variación de tus saldos por cuenta.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Es una aproximación, no un ingreso contable: los snapshots no
            distinguen por sí solos ingresos, gastos, transferencias a DPF u
            otros activos, ni cambios por tipo de cambio. Depende también de que
            los gastos estén registrados completos.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Referencia de movimientos:{" "}
        {p.flujos.meses.length
          ? p.flujos.meses.map((m) => formatDate(`${m}-01`)).join(" · ")
          : "sin meses utilizables"}
        . Se requieren dos meses entre los últimos tres, sin usar el mes actual
        incompleto. La variación de saldos compara los snapshots por cuenta más
        próximos al cierre mensual.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>¿Qué tan bien predice?</CardTitle>
            <CardDescription>
              Se predice un cierre mensual usando solo lo que se conocía antes
              de ese mes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.validacion.length ? (
              p.validacion.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-lg border p-3",
                    v.id === p.modelo.id && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="text-sm font-medium">
                    {v.nombre}
                    {v.id === p.modelo.id ? " · seleccionado" : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Error medio:{" "}
                      <strong className="text-foreground">
                        {formatBob(v.mae)}
                      </strong>
                    </span>
                    <span>Sesgo: {signo(v.sesgo)}</span>
                    <span>{v.evaluaciones} cierres evaluados</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay cierres completos evaluables. Un ajuste histórico
                alto no demuestra que una predicción vaya a acertar.
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Una tendencia debe reducir al menos un 5% el error frente a
              mantener el último saldo para ser elegida. Sesgo positivo: suele
              sobreestimar. Horizonte evaluado:{" "}
              {p.horizonteEvaluado == null
                ? "sin datos"
                : `${formatNumber(p.horizonteEvaluado, 0)} días`}
              . No se ha validado el resultado a 12 meses.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" weight="duotone" /> Tu
              meta de patrimonio
            </CardTitle>
            <CardDescription>
              Busca la primera apertura mensual que alcanzaría tu objetivo en el
              escenario visible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              key={objetivo}
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                asignar({
                  meta: String(
                    numero(
                      String(new FormData(e.currentTarget).get("meta")),
                      1,
                      1_000_000_000,
                    ),
                  ),
                });
              }}
            >
              <label className="min-w-0 flex-1 space-y-1.5 text-sm">
                <span>Objetivo (Bs)</span>
                <Input
                  name="meta"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="1000000000"
                  step="0.01"
                  defaultValue={objetivo}
                />
              </label>
              <Button type="submit" variant="outline">
                Ver meta
              </Button>
            </form>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-semibold">
                {p.base.bob >= objetivo
                  ? "Tu base ya alcanza esta meta"
                  : logro
                    ? `Primera apertura estimada: ${formatDate(logro.fecha)}`
                    : `No se alcanza en los ${meses} meses visibles`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                La fecha depende del ritmo y de los supuestos. Cambia el ahorro
                adicional para comparar cómo se acerca tu objetivo.
              </p>
            </div>
            <div className="text-xs leading-relaxed text-muted-foreground">
              Exposición neta actual: {formatNumber(p.base.exposicion, 2)}{" "}
              USD/USDT · T/C de la base: {formatNumber(p.base.rate, 4)}. Una
              variación de 1 Bs en la cotización cambia su valoración en{" "}
              {formatBob(p.base.exposicion)}, manteniendo saldos constantes.
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Calidad de los datos y supuestos</CardTitle>
          <CardDescription>
            {p.fotos} días registrados · {p.diasHistoria} días de historial ·
            corte {formatDate(p.base.fecha)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            {p.avisos.map((a) => (
              <li key={a} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                />
                {a}
              </li>
            ))}
            {p.descartadas > 0 && (
              <li>
                Se consolidaron o descartaron {p.descartadas} registros
                duplicados, futuros o inválidos para el modelo.
              </li>
            )}
            <li>
              La tendencia puede incluir ahorro, cambios de cotización y ajustes
              de activos. El crecimiento del patrimonio no representa por sí
              solo rendimiento de inversión.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function AperturaCard({ a }: { a: AperturaMensual }) {
  return (
    <article className="min-w-0 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{formatDate(a.fecha)}</h3>
        <span className="text-xs text-muted-foreground">
          {a.extrapolacion ? "Extrapolación" : "Horizonte cercano"}
        </span>
      </div>
      <div className="mt-2 break-words text-xl font-bold tabular-nums">
        {formatBob(a.patrimonio)}
      </div>
      <p
        className={cn(
          "mt-1 text-xs tabular-nums",
          a.cambio < 0 ? "text-destructive" : "text-primary",
        )}
      >
        {signo(a.cambio)} desde la base · {signo(a.cambioPeriodo)} en el periodo
      </p>
      <dl className="mt-3 space-y-2 border-t pt-3 text-xs">
        <Dato
          nombre="Rango orientativo"
          valor={
            a.rango
              ? `${formatBob(a.rango[0])} a ${formatBob(a.rango[1])}`
              : "Sin rango validado"
          }
        />
        <Dato
          nombre="Patrimonio por flujos"
          valor={formatBob(a.patrimonioPorFlujos)}
        />
        <Dato
          nombre="Disponible por flujos*"
          valor={formatBob(a.disponiblePorFlujos)}
        />
        <Dato nombre="Capital DPF previsto**" valor={formatBob(a.capitalDpf)} />
        <Dato nombre="Por cobrar previsto**" valor={formatBob(a.porCobrar)} />
      </dl>
    </article>
  );
}
function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">{nombre}</dt>
      <dd className="min-w-0 break-words text-right font-medium tabular-nums">
        {valor}
      </dd>
    </div>
  );
}
