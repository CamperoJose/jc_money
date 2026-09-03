"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Warning, TrendUp, Wallet, Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/tremor/kpi-card";
import { ProgressCircle } from "@/components/tremor/progress-circle";
import { formatBob, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResumenPresupuestos } from "@/lib/presupuestos";
import type { BudgetUI } from "@/lib/types";

function nombreMes(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
function mesAnterior(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function PresupuestosClient({ resumen }: { resumen: ResumenPresupuestos }) {
  const router = useRouter();
  const { period, filas, totalPlaneado, totalGastado, totalRestante, pctGlobal, categoriasExcedidas, categoriasEnAlerta, conPresupuesto } = resumen;
  const [error, setError] = useState<string | null>(null);
  const [copiando, setCopiando] = useState(false);

  async function guardar(categoryId: string, valor: string) {
    setError(null);
    const amount = parseFloat(valor) || 0;
    try {
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, category_id: categoryId, amount_planned: amount }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    }
  }

  async function copiarMesAnterior() {
    setError(null);
    setCopiando(true);
    try {
      const res = await fetch("/api/presupuestos/copiar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde: mesAnterior(period), hacia: period }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al copiar.");
    } finally {
      setCopiando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-sm capitalize text-muted-foreground">{nombreMes(period)}</p>
        </div>
        <Button variant="outline" onClick={copiarMesAnterior} disabled={copiando}>
          <Copy weight="bold" className="size-4" />
          {copiando ? "Copiando…" : "Copiar del mes anterior"}
        </Button>
      </div>

      {(categoriasExcedidas > 0 || categoriasEnAlerta > 0) && (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
          categoriasExcedidas > 0 ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"
        )}>
          <Warning weight="fill" className={cn("size-5 shrink-0", categoriasExcedidas > 0 ? "text-destructive" : "text-amber-600")} />
          <span>
            {categoriasExcedidas > 0 && <><strong>{categoriasExcedidas}</strong> categoría(s) excedida(s). </>}
            {categoriasEnAlerta > 0 && <><strong>{categoriasEnAlerta}</strong> cerca del límite (≥85%).</>}
          </span>
        </div>
      )}

      {/* Hero: avance global + KPIs */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex items-center gap-4 p-5">
            <ProgressCircle
              value={pctGlobal != null ? Math.min(100, pctGlobal * 100) : 0}
              radius={44}
              strokeWidth={8}
              variant={
                pctGlobal == null ? "neutral" : pctGlobal > 1 ? "error" : pctGlobal >= 0.85 ? "warning" : "success"
              }
            >
              <span className="text-sm font-bold tabular-nums">
                {pctGlobal == null ? "—" : `${Math.round(pctGlobal * 100)}%`}
              </span>
            </ProgressCircle>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Avance global
              </div>
              <div className="mt-0.5 truncate text-xl font-semibold tabular-nums">
                {formatBob(totalGastado)}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                de {formatBob(totalPlaneado)} planeado
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
          <Kpi
            etiqueta="Planeado"
            valor={formatBob(totalPlaneado)}
            detalle={`${conPresupuesto} ${conPresupuesto === 1 ? "categoría" : "categorías"} con tope`}
            icono={<Target weight="duotone" className="size-4" />}
          />
          <Kpi
            etiqueta="Gastado"
            valor={formatBob(totalGastado)}
            detalle={pctGlobal != null ? `${formatPercent(pctGlobal)} del plan` : "Sin plan definido"}
            icono={<TrendUp weight="duotone" className="size-4" />}
            tono={pctGlobal != null && pctGlobal > 1 ? "neg" : "neutral"}
          />
          <Kpi
            etiqueta="Restante"
            valor={formatBob(totalRestante)}
            detalle={totalRestante < 0 ? "Presupuesto excedido" : "Disponible este mes"}
            icono={<Wallet weight="duotone" className="size-4" />}
            tono={totalRestante < 0 ? "neg" : "pos"}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presupuesto por categoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay categorías de gasto. Créalas en Configuración → Parámetros.
            </p>
          ) : (
            filas.map((f) => <Fila key={f.category_id} f={f} onGuardar={guardar} />)
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{error}</p>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Escribe el tope mensual por categoría y presiona Enter (o sal del campo). Pon 0 para quitar el presupuesto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Fila({ f, onGuardar }: { f: BudgetUI; onGuardar: (id: string, v: string) => void }) {
  const [valor, setValor] = useState(f.planned > 0 ? String(f.planned) : "");
  const barra = Math.min(100, Math.round(f.pct * 100));
  const color = f.estado === "excedido" ? "bg-destructive" : f.estado === "alerta" ? "bg-amber-500" : "bg-primary";

  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.category_name}</span>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Bs</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="h-8 w-28 text-right"
            placeholder="0.00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => onGuardar(f.category_id, valor)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${barra}%` }} />
        </div>
        <span className="w-40 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {formatBob(f.spent)}
          {f.planned > 0 && <> / {formatBob(f.planned)} · {formatPercent(f.pct, 0)}</>}
        </span>
      </div>
    </div>
  );
}

