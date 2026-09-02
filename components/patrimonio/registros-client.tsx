"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  CaretDown,
  CaretRight,
  Warning,
  ArrowUp,
  ArrowDown,
  Minus,
  Robot,
  Hand,
  Lock,
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
import { formatBob, formatUsd, formatNumber, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/types";
import type { SnapshotUI } from "@/lib/queries/patrimonio";

interface FilaConDiff {
  s: SnapshotUI;
  diffBob: number | null;
  diffPct: number | null;
}

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

  // snapshots viene ascendente. Calculamos Δ vs. la foto anterior y luego
  // invertimos para mostrar lo más reciente arriba.
  const filas: FilaConDiff[] = useMemo(() => {
    const conDiff = snapshots.map((s, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null;
      const diffBob = prev ? Math.round((s.total_bob - prev.total_bob) * 100) / 100 : null;
      const diffPct = prev && prev.total_bob ? (s.total_bob - prev.total_bob) / prev.total_bob : null;
      return { s, diffBob, diffPct };
    });
    return conDiff.reverse();
  }, [snapshots]);

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
            {snapshots.length} {snapshots.length === 1 ? "foto" : "fotos"} · las{" "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Robot weight="fill" className="size-3.5" />
              auto
            </span>{" "}
            las genera el cierre diario; las{" "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Hand weight="fill" className="size-3.5" />
              manuales
            </span>{" "}
            las registras tú.
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
        <Card className="overflow-hidden py-0">
          <div className="relative w-full overflow-x-auto">
            <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-border [&>th]:bg-muted [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-semibold [&>th]:text-muted-foreground">
                  <th className="w-8" />
                  <th>Fecha y hora</th>
                  <th>Tipo</th>
                  <th className="text-right">T/C</th>
                  <th className="text-right">Total BOB</th>
                  <th className="text-right">Total USD</th>
                  <th className="text-right">Δ vs. anterior</th>
                  <th className="text-center">Cuentas</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ s, diffBob, diffPct }, idx) => (
                  <FilaSnapshot
                    key={s.id}
                    s={s}
                    diffBob={diffBob}
                    diffPct={diffPct}
                    zebra={idx % 2 === 1}
                    destacado={idx === 0}
                    abierto={expandido === s.id}
                    onToggle={() => setExpandido(expandido === s.id ? null : s.id)}
                    onEditar={() => editar(s)}
                    onBorrar={() => {
                      setErrorBorrar(null);
                      setBorrar(s);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {formOpen && (
        <RegistroForm
          key={editando?.id ?? "nuevo"}
          cuentas={cuentas}
          registro={editando}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}

      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar registro</DialogTitle>
          <DialogDescription>
            Se eliminará la foto del {borrar && formatDateTime(borrar.snapshot_at)} y todos sus saldos.
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
  diffBob,
  diffPct,
  zebra,
  destacado,
  abierto,
  onToggle,
  onEditar,
  onBorrar,
}: {
  s: SnapshotUI;
  diffBob: number | null;
  diffPct: number | null;
  zebra: boolean;
  destacado: boolean;
  abierto: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const esAuto = s.kind === "auto";
  const balances = [...s.balances].sort((a, b) => {
    const va = a.account.currency === "BOB" ? a.amount : a.amount * s.exchange_rate;
    const vb = b.account.currency === "BOB" ? b.amount : b.amount * s.exchange_rate;
    return vb - va;
  });

  const celda = "border-b border-border/60 px-3 py-2.5";

  return (
    <>
      <tr
        className={cn(
          "transition-colors hover:bg-accent/40",
          zebra && "bg-muted/30",
          destacado && "bg-primary/5"
        )}
      >
        <td className={cn(celda, "text-center")}>
          <button
            onClick={onToggle}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={abierto ? "Contraer" : "Expandir"}
          >
            {abierto ? <CaretDown className="size-4" /> : <CaretRight className="size-4" />}
          </button>
        </td>
        <td className={cn(celda, "whitespace-nowrap font-medium")}>
          {formatDateTime(s.snapshot_at)}
          {destacado && (
            <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
              Última
            </Badge>
          )}
        </td>
        <td className={celda}>
          {esAuto ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Robot weight="fill" className="size-3.5" />
              Auto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Hand weight="fill" className="size-3.5" />
              Manual
            </span>
          )}
        </td>
        <td className={cn(celda, "text-right tabular-nums text-muted-foreground")}>
          {formatNumber(s.exchange_rate, 2)}
        </td>
        <td className={cn(celda, "text-right font-semibold tabular-nums")}>{formatBob(s.total_bob)}</td>
        <td className={cn(celda, "text-right tabular-nums text-muted-foreground")}>
          {formatUsd(s.total_usd)}
        </td>
        <td className={cn(celda, "text-right")}>
          <DiffCelda diffBob={diffBob} diffPct={diffPct} />
        </td>
        <td className={cn(celda, "text-center tabular-nums text-muted-foreground")}>
          {s.balances.length}
        </td>
        <td className={celda}>
          <div className="flex items-center justify-end gap-1">
            {esAuto ? (
              <span
                className="p-1.5 text-muted-foreground/50"
                title="Foto autocalculada: no se edita manualmente"
              >
                <Lock className="size-4" />
              </span>
            ) : (
              <Button variant="ghost" size="icon" className="size-8" onClick={onEditar} aria-label="Editar">
                <PencilSimple className="size-4" />
              </Button>
            )}
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
          <td colSpan={9} className="border-b border-border/60 px-4 py-3">
            {s.note && (
              <div className="mb-2 text-xs italic text-muted-foreground">{s.note}</div>
            )}
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detalle por cuenta
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((b) => {
                const enBob = b.account.currency === "BOB" ? b.amount : b.amount * s.exchange_rate;
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

function DiffCelda({ diffBob, diffPct }: { diffBob: number | null; diffPct: number | null }) {
  if (diffBob == null) return <span className="text-muted-foreground">—</span>;
  const cero = Math.abs(diffBob) < 0.005;
  const sube = diffBob > 0;
  const color = cero ? "text-muted-foreground" : sube ? "text-primary" : "text-destructive";
  const Icon = cero ? Minus : sube ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex flex-col items-end tabular-nums", color)}>
      <span className="inline-flex items-center gap-1 font-semibold">
        <Icon weight="bold" className="size-3.5" />
        {formatBob(Math.abs(diffBob))}
      </span>
      {diffPct != null && !cero && (
        <span className="text-[11px] opacity-80">
          {sube ? "+" : "−"}
          {(Math.abs(diffPct) * 100).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
