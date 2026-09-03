"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  Warning,
  MagnifyingGlass,
  Vault,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { DpfForm } from "@/components/dpf/dpf-form";
import { etiquetaLiberacion } from "@/components/dpf/dpf-dashboard";
import { formatBob, formatPercent, formatDate } from "@/lib/format";
import type { Account, DpfDeposit, DpfDepositUI, DpfLiberacion } from "@/lib/types";

type FiltroEstado = "todos" | DpfLiberacion;

export function DpfClient({ dpfs, cuentas }: { dpfs: DpfDepositUI[]; cuentas: Account[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<DpfDeposit | null>(null);
  const [borrar, setBorrar] = useState<DpfDepositUI | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return dpfs.filter((d) => {
      if (filtroEstado !== "todos" && d.liberacion !== filtroEstado) return false;
      if (q) {
        const hay = [d.pizarra, d.id_dpf_externo, d.notes].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dpfs, busqueda, filtroEstado]);

  const capitalFiltrado = useMemo(
    () => filtradas.filter((d) => d.status !== "pagado").reduce((a, d) => a + d.principal, 0),
    [filtradas]
  );

  function nuevo() {
    setEditando(null);
    setFormOpen(true);
  }
  function editar(d: DpfDepositUI) {
    setEditando(d);
    setFormOpen(true);
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/inversiones/dpf/${borrar.id}`, { method: "DELETE" });
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
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">DPF · Registros</h1>
          <p className="text-sm text-muted-foreground">
            {dpfs.length} {dpfs.length === 1 ? "depósito" : "depósitos"} registrados.
          </p>
        </div>
        <Button onClick={nuevo}>
          <Plus weight="bold" className="size-4" />
          Nuevo DPF
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por entidad, Nº de DPF, nota…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select
          className="sm:w-52"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="por_liberar">Por liberar</option>
          <option value="vencido">Vencidos</option>
          <option value="pagado">Cobrados</option>
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Vault weight="duotone" className="size-8 opacity-60" />
            {dpfs.length === 0
              ? "No hay DPF aún. Registra el primero con “Nuevo DPF”."
              : "Ningún DPF coincide con los filtros."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"} · capital vigente
            </span>
            <span className="font-bold tabular-nums text-primary">{formatBob(capitalFiltrado)}</span>
          </div>

          {/* Tabla (desktop) — estilo Tremor, con más detalle por fila */}
          <Card className="hidden overflow-hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Entidad</TableHeaderCell>
                    <TableHeaderCell>Plazo</TableHeaderCell>
                    <TableHeaderCell className="min-w-[190px]">Avance</TableHeaderCell>
                    <TableHeaderCell className="text-right">Capital</TableHeaderCell>
                    <TableHeaderCell className="text-right">Tasa</TableHeaderCell>
                    <TableHeaderCell className="text-right">Interés líquido</TableHeaderCell>
                    <TableHeaderCell className="text-right">Al vencimiento</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtradas.map((d) => {
                    const et = etiquetaLiberacion(d);
                    const pct = Math.round(Math.min(1, Math.max(0, d.progreso)) * 100);
                    const vencido = d.liberacion === "vencido";
                    return (
                      <TableRow key={d.id}>
                        {/* Entidad + identificadores */}
                        <TableCell className="max-w-[190px]">
                          <div className="truncate font-medium text-foreground">{d.pizarra || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[d.nro_dpf && `Nº ${d.nro_dpf}`, d.id_dpf_externo, d.edv && `EDV ${d.edv}`]
                              .filter(Boolean)
                              .join(" · ") || "sin identificador"}
                          </div>
                        </TableCell>

                        {/* Inicio → fin + meses */}
                        <TableCell className="whitespace-nowrap">
                          <div className="text-foreground">
                            {formatDate(d.start_date)} → {formatDate(d.end_date)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.term_months} {d.term_months === 1 ? "mes" : "meses"} · {d.diasTotales} d
                          </div>
                        </TableCell>

                        {/* Avance con barra */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  d.status === "pagado"
                                    ? "bg-muted-foreground"
                                    : vencido
                                      ? "bg-destructive"
                                      : "bg-primary"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                          <div className={`mt-1 text-xs ${vencido ? "text-destructive" : "text-muted-foreground"}`}>
                            {d.status === "pagado"
                              ? "cobrado"
                              : d.diasRestantes < 0
                                ? `venció hace ${Math.abs(d.diasRestantes)} d`
                                : d.diasRestantes === 0
                                  ? "vence hoy"
                                  : `faltan ${d.diasRestantes} d`}
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatBob(d.principal)}
                        </TableCell>

                        {/* Tasa + interés mensual */}
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="tabular-nums text-foreground">{formatPercent(d.annual_rate, 2)}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {formatBob(d.interesMensual)}/mes
                          </div>
                        </TableCell>

                        {/* Interés líquido + RC-IVA */}
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="font-medium tabular-nums text-primary">{formatBob(d.interesLiquido)}</div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            {d.cobra_iva ? `RC-IVA ${formatBob(d.rcIva)}` : "sin IVA"}
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                          {formatBob(d.montoAlVencimiento)}
                        </TableCell>

                        <TableCell>
                          <Badge variant={et.color}>{et.texto}</Badge>
                          {d.status === "pagado" && d.paidAccount && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              → {d.paidAccount.name}
                              {d.paid_at ? ` · ${formatDate(d.paid_at)}` : ""}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => editar(d)} aria-label="Editar">
                              <PencilSimple className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                setErrorBorrar(null);
                                setBorrar(d);
                              }}
                              aria-label="Borrar"
                            >
                              <Trash className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFoot>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="font-semibold">
                      {filtradas.length} {filtradas.length === 1 ? "DPF" : "DPFs"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBob(filtradas.reduce((s, d) => s + d.principal, 0))}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {formatBob(filtradas.reduce((s, d) => s + d.interesLiquido, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatBob(filtradas.reduce((s, d) => s + d.montoAlVencimiento, 0))}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFoot>
              </Table>
            </TableRoot>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="grid gap-2 lg:hidden">
            {filtradas.map((d) => {
              const et = etiquetaLiberacion(d);
              return (
                <Card key={d.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{d.pizarra || "DPF"}</span>
                          <Badge variant={et.color}>{et.texto}</Badge>
                        </div>
                        {d.id_dpf_externo && (
                          <div className="text-xs text-muted-foreground">{d.id_dpf_externo}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(d.start_date)} → {formatDate(d.end_date)} · {formatPercent(d.annual_rate, 2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold tabular-nums">{formatBob(d.principal)}</span>
                        <span className="text-xs tabular-nums text-primary">+{formatBob(d.interesLiquido)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {d.status === "pagado"
                          ? `Cobrado${d.paidAccount ? ` → ${d.paidAccount.name}` : ""}`
                          : d.diasRestantes < 0
                            ? `venció hace ${Math.abs(d.diasRestantes)} d`
                            : d.diasRestantes === 0
                              ? "vence hoy"
                              : `faltan ${d.diasRestantes} d`}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => editar(d)} aria-label="Editar">
                          <PencilSimple className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            setErrorBorrar(null);
                            setBorrar(d);
                          }}
                          aria-label="Borrar"
                        >
                          <Trash className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {formOpen && (
        <DpfForm
          key={editando?.id ?? "nuevo"}
          cuentas={cuentas}
          registro={editando}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}

      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar DPF</DialogTitle>
          <DialogDescription>
            Se eliminará el DPF{borrar?.pizarra ? ` de ${borrar.pizarra}` : ""}
            {borrar?.id_dpf_externo ? ` (${borrar.id_dpf_externo})` : ""}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {errorBorrar && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <Warning weight="fill" className="size-4" />
            {errorBorrar}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setBorrar(null)} disabled={borrando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmarBorrar} disabled={borrando}>
            <Trash weight="bold" className="size-4" />
            {borrando ? "Borrando…" : "Borrar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
