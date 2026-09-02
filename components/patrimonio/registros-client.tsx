"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  CaretDown,
  CaretRight,
  Warning,
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
import { RegistroForm } from "@/components/patrimonio/registro-form";
import { formatBob, formatUsd, formatNumber, formatDate } from "@/lib/format";
import type { Account } from "@/lib/types";
import type { SnapshotUI } from "@/lib/queries/patrimonio";

export function RegistrosClient({
  snapshots,
  cuentas,
}: {
  snapshots: SnapshotUI[];
  cuentas: Account[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<SnapshotUI | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<SnapshotUI | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  // Más recientes primero.
  const filas = [...snapshots].reverse();

  function nuevo() {
    setEditando(null);
    setFormOpen(true);
  }
  function editar(s: SnapshotUI) {
    setEditando(s);
    setFormOpen(true);
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/patrimonio/snapshots/${borrar.id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-bold">Registros de Patrimonio</h1>
          <p className="text-sm text-muted-foreground">
            {snapshots.length} {snapshots.length === 1 ? "foto registrada" : "fotos registradas"}. Cada
            fila es una fecha; despliega para ver el detalle por cuenta.
          </p>
        </div>
        <Button onClick={nuevo}>
          <Plus weight="bold" className="size-4" />
          Nuevo registro
        </Button>
      </div>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No hay registros aún. Crea el primero con “Nuevo registro”.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative w-full overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-muted-foreground">
                  <th className="w-8 px-2 py-2.5" />
                  <th className="px-2 py-2.5 font-medium">Fecha</th>
                  <th className="px-2 py-2.5 text-right font-medium">T/C</th>
                  <th className="px-2 py-2.5 text-right font-medium">Total BOB</th>
                  <th className="px-2 py-2.5 text-right font-medium">Total USD</th>
                  <th className="px-2 py-2.5 text-center font-medium">Cuentas</th>
                  <th className="px-2 py-2.5 font-medium">Nota</th>
                  <th className="px-2 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((s) => {
                  const abierto = expandido === s.id;
                  return (
                    <FilaSnapshot
                      key={s.id}
                      s={s}
                      abierto={abierto}
                      onToggle={() => setExpandido(abierto ? null : s.id)}
                      onEditar={() => editar(s)}
                      onBorrar={() => {
                        setErrorBorrar(null);
                        setBorrar(s);
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Formulario crear/editar */}
      {formOpen && (
        <RegistroForm
          key={editando?.id ?? "nuevo"}
          cuentas={cuentas}
          registro={editando}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}

      {/* Confirmar borrado */}
      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar registro</DialogTitle>
          <DialogDescription>
            Se eliminará la foto del {borrar && formatDate(borrar.snapshot_date)} y todos sus saldos.
            Esta acción no se puede deshacer.
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

function FilaSnapshot({
  s,
  abierto,
  onToggle,
  onEditar,
  onBorrar,
}: {
  s: SnapshotUI;
  abierto: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const balances = [...s.balances].sort((a, b) => {
    const va = a.account.currency === "BOB" ? a.amount : a.amount * s.exchange_rate;
    const vb = b.account.currency === "BOB" ? b.amount : b.amount * s.exchange_rate;
    return vb - va;
  });

  return (
    <>
      <tr className="border-b transition-colors hover:bg-muted/40">
        <td className="px-2 py-2">
          <button
            onClick={onToggle}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={abierto ? "Contraer" : "Expandir"}
          >
            {abierto ? <CaretDown className="size-4" /> : <CaretRight className="size-4" />}
          </button>
        </td>
        <td className="px-2 py-2 font-medium">{formatDate(s.snapshot_date)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(s.exchange_rate, 2)}</td>
        <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatBob(s.total_bob)}</td>
        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatUsd(s.total_usd)}</td>
        <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{s.balances.length}</td>
        <td className="max-w-[160px] truncate px-2 py-2 text-xs text-muted-foreground" title={s.note ?? ""}>
          {s.note ?? ""}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={onEditar} aria-label="Editar">
              <PencilSimple className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={onBorrar}
              aria-label="Borrar"
            >
              <Trash className="size-4" />
            </Button>
          </div>
        </td>
      </tr>
      {abierto && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detalle por cuenta
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((b) => {
                const enBob =
                  b.account.currency === "BOB" ? b.amount : b.amount * s.exchange_rate;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {b.account.name}
                        <Badge variant={b.account.is_liability ? "destructive" : "secondary"}>
                          {b.account.currency}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatNumber(b.amount, 2)} {b.account.currency}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatBob(b.account.is_liability ? -enBob : enBob)}
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
