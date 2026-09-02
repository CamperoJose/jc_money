"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  Warning,
  Package,
  TrendUp,
  Vault,
  Coins,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ActivoForm } from "@/components/activos/activo-form";
import { formatBob, formatDate, formatPercent } from "@/lib/format";
import type { ResumenActivos } from "@/lib/activos";
import type { Account, AssetUI } from "@/lib/types";

export function ActivosClient({ resumen, cuentas }: { resumen: ResumenActivos; cuentas: Account[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<AssetUI | null>(null);
  const [borrar, setBorrar] = useState<AssetUI | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const {
    activos,
    valorEnPatrimonio,
    valorTotalActivos,
    plusvaliaNoRealizada,
    gananciaRealizada,
    cuentaActivos,
    cuentaVendidos,
    rendimientoRealizado,
  } = resumen;

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/activos/${borrar.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setBorrar(null);
      router.refresh();
    } catch (e) {
      setErrorBorrar(e instanceof Error ? e.message : "Error al borrar.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activos</h1>
          <p className="text-sm text-muted-foreground">
            {cuentaActivos} {cuentaActivos === 1 ? "activo" : "activos"} · {cuentaVendidos} vendidos
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus weight="bold" className="size-4" />
          Nuevo activo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Vault weight="duotone" className="size-5 text-primary" />} label="En patrimonio" valor={formatBob(valorEnPatrimonio)} sub={`Valor total ${formatBob(valorTotalActivos)}`} />
        <Kpi icon={<TrendUp weight="duotone" className="size-5 text-primary" />} label="Plusvalía no realizada" valor={formatBob(plusvaliaNoRealizada)} tono={plusvaliaNoRealizada >= 0 ? "bueno" : "malo"} />
        <Kpi icon={<Coins weight="duotone" className="size-5 text-primary" />} label="Ganancia realizada" valor={formatBob(gananciaRealizada)} sub={`${cuentaVendidos} vendidos`} tono={gananciaRealizada >= 0 ? "bueno" : "malo"} />
        <Kpi icon={<Package weight="duotone" className="size-5 text-muted-foreground" />} label="Rendimiento realizado" valor={rendimientoRealizado == null ? "—" : formatPercent(rendimientoRealizado, 1)} />
      </div>

      {activos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Package weight="duotone" className="size-8 opacity-60" />
            No hay activos registrados. Agrega el primero con “Nuevo activo”.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabla (desktop) */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="relative w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Activo</th>
                    <th className="px-3 py-2.5 font-medium">Adquirido</th>
                    <th className="px-3 py-2.5 text-right font-medium">Costo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Valor / Venta</th>
                    <th className="px-3 py-2.5 text-right font-medium">Resultado</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activos.map((a) => (
                    <tr key={a.id} className="border-b transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{a.name}</div>
                        {a.category && <div className="text-xs text-muted-foreground">{a.category}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {a.acquired_date ? formatDate(a.acquired_date) : "—"}
                        {a.diasTenencia != null && <div className="text-xs">{a.diasTenencia} d</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatBob(a.acquisition_cost)} {a.currency !== "BOB" && <span className="text-xs">{a.currency}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {a.realizado ? formatBob(a.sold_price ?? 0) : formatBob(a.valorActual)}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${a.resultado >= 0 ? "text-primary" : "text-destructive"}`}>
                        {a.resultado >= 0 ? "+" : ""}{formatBob(a.resultado)}
                        {a.resultadoPct != null && <div className="text-xs font-normal">{formatPercent(a.resultadoPct, 1)}</div>}
                      </td>
                      <td className="px-3 py-2.5"><EstadoBadge a={a} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditando(a); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(a); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="grid gap-2 lg:hidden">
            {activos.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{a.name}</span>
                        <EstadoBadge a={a} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {a.acquired_date ? formatDate(a.acquired_date) : "—"} · costo {formatBob(a.acquisition_cost)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums">{a.realizado ? formatBob(a.sold_price ?? 0) : formatBob(a.valorActual)}</span>
                      <span className={`text-xs font-medium tabular-nums ${a.resultado >= 0 ? "text-primary" : "text-destructive"}`}>
                        {a.resultado >= 0 ? "+" : ""}{formatBob(a.resultado)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditando(a); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(a); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <ActivoForm key={editando?.id ?? "nuevo"} registro={editando} cuentas={cuentas} open={formOpen} onOpenChange={setFormOpen} />
      )}

      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar activo</DialogTitle>
          <DialogDescription>Se eliminará “{borrar?.name}”. Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        {errorBorrar && <p className="flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{errorBorrar}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setBorrar(null)} disabled={borrando}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmarBorrar} disabled={borrando}><Trash weight="bold" className="size-4" />{borrando ? "Borrando…" : "Borrar"}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function EstadoBadge({ a }: { a: AssetUI }) {
  if (a.realizado) return <Badge variant="secondary">Vendido</Badge>;
  if (!a.counts_in_patrimonio) return <Badge variant="outline">No contable</Badge>;
  return <Badge variant="success">En patrimonio</Badge>;
}

function Kpi({ icon, label, valor, sub, tono }: { icon: React.ReactNode; label: string; valor: string; sub?: string; tono?: "bueno" | "malo" }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted/60 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold tabular-nums ${tono === "malo" ? "text-destructive" : tono === "bueno" ? "text-primary" : ""}`}>{valor}</div>
          {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
