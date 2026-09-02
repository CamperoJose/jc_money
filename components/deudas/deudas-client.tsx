"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  Warning,
  HandCoins,
  Clock,
  CheckCircle,
  Users,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeudaForm } from "@/components/deudas/deuda-form";
import { formatBob, formatDate, formatBobCompact } from "@/lib/format";
import type { ResumenDeudas } from "@/lib/deudas";
import type { DebtUI } from "@/lib/types";

export function DeudasClient({ resumen }: { resumen: ResumenDeudas }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<DebtUI | null>(null);
  const [borrar, setBorrar] = useState<DebtUI | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const { deudas, totalPorCobrar, totalCobrado, cuentaPendientes, cuentaVencidas, porCobrarVencido, porContraparte } = resumen;

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/deudas/${borrar.id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-bold">Deudas · Que me deben</h1>
          <p className="text-sm text-muted-foreground">
            {cuentaPendientes} {cuentaPendientes === 1 ? "deuda pendiente" : "deudas pendientes"} · suma a tu patrimonio (Por Cobrar)
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus weight="bold" className="size-4" />
          Nueva deuda
        </Button>
      </div>

      {cuentaVencidas > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <Warning weight="fill" className="size-5 shrink-0 text-destructive" />
          <span>
            <strong>{cuentaVencidas}</strong> {cuentaVencidas === 1 ? "deuda vencida" : "deudas vencidas"} ·{" "}
            {formatBob(porCobrarVencido)} por cobrar pasados de fecha.
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<HandCoins weight="duotone" className="size-5 text-primary" />} label="Total por cobrar" valor={formatBob(totalPorCobrar)} />
        <Kpi icon={<CheckCircle weight="duotone" className="size-5 text-primary" />} label="Ya cobrado" valor={formatBob(totalCobrado)} />
        <Kpi icon={<Clock weight="duotone" className="size-5 text-muted-foreground" />} label="Pendientes" valor={String(cuentaPendientes)} sub={`${cuentaVencidas} vencidas`} tono={cuentaVencidas > 0 ? "malo" : undefined} />
        <Kpi icon={<Users weight="duotone" className="size-5 text-muted-foreground" />} label="Deudores" valor={String(porContraparte.length)} />
      </div>

      {porContraparte.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Por cobrar por persona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {porContraparte.slice(0, 8).map((c) => (
              <div key={c.nombre} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">{formatBob(c.monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {deudas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <HandCoins weight="duotone" className="size-8 opacity-60" />
            No hay deudas registradas. Agrega la primera con “Nueva deuda”.
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
                    <th className="px-3 py-2.5 font-medium">Deudor</th>
                    <th className="px-3 py-2.5 font-medium">Motivo</th>
                    <th className="px-3 py-2.5 font-medium">Fecha</th>
                    <th className="px-3 py-2.5 font-medium">Vence</th>
                    <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                    <th className="px-3 py-2.5 text-right font-medium">Por cobrar</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deudas.map((d) => (
                    <tr key={d.id} className="border-b transition-colors hover:bg-muted/40">
                      <td className="px-3 py-2.5 font-medium">{d.counterparty || "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground" title={d.reason ?? ""}>{d.reason || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(d.debt_date)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {d.due_date ? (
                          <span className={d.vencida ? "text-destructive" : "text-muted-foreground"}>
                            {formatDate(d.due_date)}
                            {d.vencida && d.diasVencida ? ` (+${d.diasVencida}d)` : ""}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatBob(d.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-primary">{formatBob(d.outstanding)}</td>
                      <td className="px-3 py-2.5"><EstadoBadge d={d} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditando(d); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(d); }} aria-label="Borrar"><Trash className="size-4" /></Button>
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
            {deudas.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{d.counterparty || "—"}</span>
                        <EstadoBadge d={d} />
                      </div>
                      {d.reason && <div className="truncate text-xs text-muted-foreground">{d.reason}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(d.debt_date)}{d.due_date ? ` → vence ${formatDate(d.due_date)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold tabular-nums text-primary">{formatBob(d.outstanding)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">de {formatBobCompact(d.amount)}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditando(d); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(d); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <DeudaForm key={editando?.id ?? "nuevo"} registro={editando} open={formOpen} onOpenChange={setFormOpen} />
      )}

      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar deuda</DialogTitle>
          <DialogDescription>
            Se eliminará la deuda{borrar?.counterparty ? ` de ${borrar.counterparty}` : ""}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {errorBorrar && (
          <p className="flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{errorBorrar}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setBorrar(null)} disabled={borrando}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmarBorrar} disabled={borrando}>
            <Trash weight="bold" className="size-4" />
            {borrando ? "Borrando…" : "Borrar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function EstadoBadge({ d }: { d: DebtUI }) {
  if (d.status === "pagado") return <Badge variant="secondary">Cobrado</Badge>;
  if (d.vencida) return <Badge variant="destructive">Vencida</Badge>;
  if (d.status === "parcial") return <Badge variant="success">Parcial</Badge>;
  return <Badge variant="outline">Pendiente</Badge>;
}

function Kpi({ icon, label, valor, sub, tono }: { icon: React.ReactNode; label: string; valor: string; sub?: string; tono?: "malo" }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted/60 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold tabular-nums ${tono === "malo" ? "text-destructive" : ""}`}>{valor}</div>
          {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
