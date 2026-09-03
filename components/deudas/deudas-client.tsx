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
  Coins,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { DeudaForm } from "@/components/deudas/deuda-form";
import { formatBob, formatDate, formatBobCompact } from "@/lib/format";
import { fechaBoliviaHoy } from "@/lib/datetime";
import type { ResumenDeudas } from "@/lib/deudas";
import type { Account, DebtUI } from "@/lib/types";

export function DeudasClient({ resumen, cuentas }: { resumen: ResumenDeudas; cuentas: Account[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<DebtUI | null>(null);
  const [cobrar, setCobrar] = useState<DebtUI | null>(null);
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
          {/* Tabla (desktop) — estilo Tremor, con más detalle por fila */}
          <Card className="hidden overflow-hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Deudor / motivo</TableHeaderCell>
                    <TableHeaderCell>Prestado</TableHeaderCell>
                    <TableHeaderCell>Vencimiento</TableHeaderCell>
                    <TableHeaderCell className="text-right">Monto</TableHeaderCell>
                    <TableHeaderCell className="min-w-[190px]">Avance de cobro</TableHeaderCell>
                    <TableHeaderCell className="text-right">Por cobrar</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deudas.map((d) => {
                    const pct = d.amount > 0 ? d.paid_amount / d.amount : 0;
                    const cuentaCobro = cuentas.find((c) => c.id === d.paid_account_id);
                    return (
                      <TableRow key={d.id}>
                        {/* Deudor + motivo */}
                        <TableCell className="max-w-[220px]">
                          <div className="truncate font-medium text-foreground">{d.counterparty || "—"}</div>
                          {d.reason && (
                            <div className="truncate text-xs text-muted-foreground" title={d.reason}>{d.reason}</div>
                          )}
                        </TableCell>

                        {/* Fecha + antigüedad */}
                        <TableCell className="whitespace-nowrap">
                          <div className="text-foreground">{formatDate(d.debt_date)}</div>
                          <div className="text-xs text-muted-foreground">hace {diasDesde(d.debt_date)} d</div>
                        </TableCell>

                        {/* Vencimiento + días restantes */}
                        <TableCell className="whitespace-nowrap">
                          {d.due_date ? (
                            <>
                              <div className={d.vencida ? "font-medium text-destructive" : "text-foreground"}>
                                {formatDate(d.due_date)}
                              </div>
                              <div className={`text-xs ${d.vencida ? "text-destructive" : "text-muted-foreground"}`}>
                                {textoVencimiento(d)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Sin fecha</span>
                          )}
                        </TableCell>

                        {/* Monto total */}
                        <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                          {formatBob(d.amount)}
                        </TableCell>

                        {/* Avance de cobro: barra + cobrado + cuenta destino */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${d.status === "pagado" ? "bg-emerald-500" : "bg-primary"}`}
                                style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
                              />
                            </div>
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {Math.round(pct * 100)}%
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            Cobrado {formatBob(d.paid_amount)}
                            {cuentaCobro ? ` · ${cuentaCobro.name}` : ""}
                            {d.collected_date ? ` · ${formatDate(d.collected_date)}` : ""}
                          </div>
                        </TableCell>

                        {/* Por cobrar */}
                        <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-primary">
                          {formatBob(d.outstanding)}
                        </TableCell>

                        <TableCell><EstadoBadge d={d} /></TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {d.outstanding > 0 && (
                              <Button variant="ghost" size="icon" className="size-8 text-primary hover:text-primary" onClick={() => setCobrar(d)} aria-label="Recibir cobro" title="Recibir cobro"><Coins weight="fill" className="size-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditando(d); setFormOpen(true); }} aria-label="Editar"><PencilSimple className="size-4" /></Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => { setErrorBorrar(null); setBorrar(d); }} aria-label="Borrar"><Trash className="size-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFoot>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="font-semibold">
                      {deudas.length} {deudas.length === 1 ? "deuda" : "deudas"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBob(deudas.reduce((s, d) => s + d.amount, 0))}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-muted-foreground">
                      Cobrado {formatBob(totalCobrado)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {formatBob(totalPorCobrar)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFoot>
              </Table>
            </TableRoot>
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
                  <div className="mt-2 flex items-center justify-end gap-1">
                    {d.outstanding > 0 && (
                      <Button variant="outline" size="sm" className="mr-auto h-7" onClick={() => setCobrar(d)}><Coins weight="fill" className="size-4" />Recibir cobro</Button>
                    )}
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
        <DeudaForm key={editando?.id ?? "nuevo"} registro={editando} cuentas={cuentas} open={formOpen} onOpenChange={setFormOpen} />
      )}

      {cobrar && (
        <CobroDialog
          deuda={cobrar}
          cuentas={cuentas}
          onClose={(refrescar) => {
            setCobrar(null);
            if (refrescar) router.refresh();
          }}
        />
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

/** Días transcurridos desde una fecha YYYY-MM-DD (en zona Bolivia). */
function diasDesde(fecha: string): number {
  const a = Date.parse(`${fecha}T00:00:00Z`);
  const b = Date.parse(`${fechaBoliviaHoy()}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Texto de vencimiento: vencida hace N días, vence hoy o faltan N días. */
function textoVencimiento(d: DebtUI): string {
  if (d.status === "pagado") return "cobrada";
  if (d.vencida) return `vencida hace ${d.diasVencida ?? 0} d`;
  if (!d.due_date) return "";
  const faltan = -diferenciaDias(fechaBoliviaHoy(), d.due_date);
  if (faltan === 0) return "vence hoy";
  return `faltan ${faltan} d`;
}

/** b − a en días (fechas YYYY-MM-DD). */
function diferenciaDias(a: string, b: string): number {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return 0;
  return Math.round((ma - mb) / 86_400_000);
}

/** Cuentas destino válidas para recibir un cobro (reales, no derivadas). */
function cuentasDestino(cuentas: Account[]): Account[] {
  return cuentas.filter((c) => c.active && !c.is_liability && c.type !== "dpf" && c.type !== "por_cobrar");
}

/** Diálogo "Recibir cobro": marca a qué cuenta llegó el dinero (hoy). El job lo
 *  mueve de "Por cobrar" a esa cuenta; el patrimonio total no cambia. */
function CobroDialog({
  deuda,
  cuentas,
  onClose,
}: {
  deuda: DebtUI;
  cuentas: Account[];
  onClose: (refrescar: boolean) => void;
}) {
  const destinos = cuentasDestino(cuentas);
  const [cuentaId, setCuentaId] = useState(deuda.paid_account_id ?? "");
  const [monto, setMonto] = useState(String(deuda.outstanding));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoN = parseFloat(monto) || 0;
  const nuevoPagado = Math.min(deuda.amount, Math.round((deuda.paid_amount + montoN) * 100) / 100);
  const cuentaSel = destinos.find((c) => c.id === cuentaId);

  async function confirmar() {
    setError(null);
    if (!(montoN > 0)) return setError("Ingresa el monto recibido.");
    if (montoN > deuda.outstanding + 0.001) return setError("El cobro no puede superar lo que falta por cobrar.");
    if (!cuentaId) return setError("Elige la cuenta a la que llegó el dinero.");
    setEnviando(true);
    try {
      const res = await fetch(`/api/deudas/${deuda.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debt_date: deuda.debt_date,
          amount: deuda.amount,
          paid_amount: nuevoPagado,
          reason: deuda.reason,
          counterparty: deuda.counterparty,
          due_date: deuda.due_date,
          paid_account_id: cuentaId,
          collected_date: fechaBoliviaHoy(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar el cobro.");
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onClose(false)}>
      <DialogHeader>
        <DialogTitle>Recibir cobro</DialogTitle>
        <DialogDescription>
          Registra que {deuda.counterparty || "el deudor"} te pagó. Se asume que el dinero llegó ahora. Tu patrimonio
          total no cambia: solo se mueve de “Por cobrar” a la cuenta que elijas (sube tu disponibilidad).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Por cobrar</span>
          <span className="font-semibold text-primary tabular-nums">{formatBob(deuda.outstanding)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="montoCobro">Monto recibido (Bs)</Label>
            <Input id="montoCobro" type="number" step="0.01" min="0" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cuentaCobro">¿A qué cuenta llegó?</Label>
            <Select id="cuentaCobro" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">— Elige cuenta —</option>
              {destinos.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se registra con fecha de hoy. El job de medianoche mueve {cuentaSel ? `el dinero a ${cuentaSel.name}` : "el dinero a la cuenta elegida"}.
          {nuevoPagado >= deuda.amount ? " La deuda quedará como cobrada." : " La deuda quedará parcialmente cobrada."}
        </p>
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{error}</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onClose(false)} disabled={enviando}>Cancelar</Button>
        <Button onClick={confirmar} disabled={enviando}>
          <Coins weight="fill" className="size-4" />
          {enviando ? "Guardando…" : "Registrar cobro"}
        </Button>
      </DialogFooter>
    </Dialog>
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
