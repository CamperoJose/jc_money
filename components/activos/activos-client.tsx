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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Activos</h1>
          <p className="text-sm text-muted-foreground">
            {cuentaActivos} {cuentaActivos === 1 ? "activo" : "activos"} · {cuentaVendidos} vendidos
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus weight="bold" className="size-4" />
          Nuevo activo
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
          {/* Tabla (desktop) — estilo Tremor, con más detalle por fila */}
          <Card className="hidden overflow-hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Activo</TableHeaderCell>
                    <TableHeaderCell>Adquirido</TableHeaderCell>
                    <TableHeaderCell className="text-right">Costo</TableHeaderCell>
                    <TableHeaderCell className="text-right">Valor / Venta</TableHeaderCell>
                    <TableHeaderCell className="min-w-[170px]">Resultado</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activos.map((a) => {
                    const cuentaVenta = cuentas.find((c) => c.id === a.sold_account_id);
                    // Magnitud relativa del resultado para la barra (cap a ±50%).
                    const mag = a.resultadoPct != null ? Math.min(1, Math.abs(a.resultadoPct) / 0.5) : 0;
                    const positivo = a.resultado >= 0;
                    return (
                      <TableRow key={a.id}>
                        {/* Nombre + categoría + moneda */}
                        <TableCell className="max-w-[220px]">
                          <div className="truncate font-medium text-foreground">{a.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {a.category && <span className="truncate">{a.category}</span>}
                            {a.currency !== "BOB" && <Badge variant="neutral">{a.currency}</Badge>}
                            {!a.counts_in_patrimonio && <span>· no contable</span>}
                          </div>
                        </TableCell>

                        {/* Adquisición + tenencia */}
                        <TableCell className="whitespace-nowrap">
                          <div className="text-foreground">{a.acquired_date ? formatDate(a.acquired_date) : "—"}</div>
                          {a.diasTenencia != null && (
                            <div className="text-xs text-muted-foreground">
                              {a.diasTenencia} d {a.realizado ? "hasta la venta" : "en cartera"}
                            </div>
                          )}
                        </TableCell>

                        {/* Costo */}
                        <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                          {formatBob(a.acquisition_cost)}
                        </TableCell>

                        {/* Valor actual o precio de venta + cuenta destino */}
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="font-medium tabular-nums text-foreground">
                            {a.realizado ? formatBob(a.sold_price ?? 0) : formatBob(a.valorActual)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.realizado
                              ? `vendido${a.sold_date ? ` ${formatDate(a.sold_date)}` : ""}${cuentaVenta ? ` → ${cuentaVenta.name}` : ""}`
                              : "valor estimado"}
                          </div>
                        </TableCell>

                        {/* Resultado con barra de magnitud */}
                        <TableCell>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold tabular-nums ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                              {positivo ? "+" : ""}{formatBob(a.resultado)}
                            </span>
                            {a.resultadoPct != null && (
                              <span className={`text-xs tabular-nums ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                                {formatPercent(a.resultadoPct, 1)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex h-1.5 w-full canal overflow-hidden rounded-full bg-muted">
                            <div className="flex w-1/2 justify-end">
                              {!positivo && (
                                <div className="relleno-brillo h-full rounded-l-full bg-destructive transition-all" style={{ width: `${mag * 100}%` }} />
                              )}
                            </div>
                            <div className="flex w-1/2 justify-start">
                              {positivo && (
                                <div className="relleno-brillo h-full rounded-r-full bg-emerald-500 transition-all" style={{ width: `${mag * 100}%` }} />
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell><EstadoBadge a={a} /></TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditando(a); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(a); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFoot>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="font-semibold">
                      {activos.length} {activos.length === 1 ? "activo" : "activos"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBob(activos.reduce((s, a) => s + a.acquisition_cost, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBob(activos.reduce((s, a) => s + (a.realizado ? (a.sold_price ?? 0) : a.valorActual), 0))}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {(() => {
                        const t = activos.reduce((s, a) => s + a.resultado, 0);
                        return (
                          <span className={t >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                            {t >= 0 ? "+" : ""}{formatBob(t)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFoot>
              </Table>
            </TableRoot>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="grid gap-2 lg:hidden">
            {activos.map((a) => {
              const cuentaVenta = cuentas.find((c) => c.id === a.sold_account_id);
              const mag = a.resultadoPct != null ? Math.min(1, Math.abs(a.resultadoPct) / 0.5) : 0;
              const positivo = a.resultado >= 0;
              return (
                <Card key={a.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{a.name}</span>
                          <EstadoBadge a={a} />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {a.category && <span className="truncate">{a.category}</span>}
                          {a.currency !== "BOB" && <Badge variant="neutral">{a.currency}</Badge>}
                          {!a.counts_in_patrimonio && <span>· no contable</span>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {a.acquired_date ? formatDate(a.acquired_date) : "—"} · costo {formatBob(a.acquisition_cost)}
                        </div>
                        {a.diasTenencia != null && (
                          <div className="text-xs text-muted-foreground">
                            {a.diasTenencia} d {a.realizado ? "hasta la venta" : "en cartera"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold tabular-nums">
                          {a.realizado ? formatBob(a.sold_price ?? 0) : formatBob(a.valorActual)}
                        </span>
                        <span className="text-right text-xs text-muted-foreground">
                          {a.realizado
                            ? `vendido${a.sold_date ? ` ${formatDate(a.sold_date)}` : ""}${cuentaVenta ? ` → ${cuentaVenta.name}` : ""}`
                            : "valor estimado"}
                        </span>
                      </div>
                    </div>

                    {/* Resultado con barra bidireccional (igual que en escritorio). */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className={`font-semibold tabular-nums ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {positivo ? "+" : ""}{formatBob(a.resultado)}
                      </span>
                      {a.resultadoPct != null && (
                        <span className={`text-xs tabular-nums ${positivo ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                          {formatPercent(a.resultadoPct, 1)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex h-1.5 w-full canal overflow-hidden rounded-full bg-muted">
                      <div className="flex w-1/2 justify-end">
                        {!positivo && (
                          <div className="relleno-brillo h-full rounded-l-full bg-destructive transition-all" style={{ width: `${mag * 100}%` }} />
                        )}
                      </div>
                      <div className="flex w-1/2 justify-start">
                        {positivo && (
                          <div className="relleno-brillo h-full rounded-r-full bg-emerald-500 transition-all" style={{ width: `${mag * 100}%` }} />
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditando(a); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(a); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          <span className="shrink-0">{icon}</span>
        </div>
        <div className={`mt-1 truncate text-3xl font-semibold tabular-nums ${tono === "malo" ? "text-destructive" : tono === "bueno" ? "text-primary" : ""}`}>{valor}</div>
        {sub && <div className="mt-1 truncate text-sm text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
