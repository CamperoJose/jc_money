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
  prev: SnapshotUI | null;
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
      return { s, prev, diffBob, diffPct };
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Registros de Patrimonio</h1>
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
                  <th className="hidden text-right md:table-cell">T/C</th>
                  <th className="text-right">Total BOB</th>
                  <th className="hidden text-right lg:table-cell">Total USD</th>
                  <th className="text-right">Δ vs. anterior</th>
                  <th className="hidden text-center sm:table-cell">Cuentas</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ s, prev, diffBob, diffPct }, idx) => (
                  <FilaSnapshot
                    key={s.id}
                    s={s}
                    prev={prev}
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
          ultimo={snapshots.at(-1) ?? null}
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
  prev,
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
  prev: SnapshotUI | null;
  diffBob: number | null;
  diffPct: number | null;
  zebra: boolean;
  destacado: boolean;
  abierto: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const [modoDiff, setModoDiff] = useState(false);
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
        <td className={cn(celda, "hidden text-right tabular-nums text-muted-foreground md:table-cell")}>
          {formatNumber(s.exchange_rate, 2)}
        </td>
        <td className={cn(celda, "text-right font-semibold tabular-nums")}>{formatBob(s.total_bob)}</td>
        <td className={cn(celda, "hidden text-right tabular-nums text-muted-foreground lg:table-cell")}>
          {formatUsd(s.total_usd)}
        </td>
        <td className={cn(celda, "text-right")}>
          <DiffCelda diffBob={diffBob} diffPct={diffPct} />
        </td>
        <td className={cn(celda, "hidden text-center tabular-nums text-muted-foreground sm:table-cell")}>
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {modoDiff ? "Cambios cuenta por cuenta" : "Detalle por cuenta"}
                {modoDiff && !prev && <span className="ml-1 normal-case">· sin foto anterior</span>}
              </div>
              <div className="inline-flex rounded-lg border p-0.5">
                <button
                  onClick={() => setModoDiff(false)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    !modoDiff ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Saldos
                </button>
                <button
                  onClick={() => setModoDiff(true)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    modoDiff ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cambios Δ
                </button>
              </div>
            </div>

            {modoDiff ? (
              <DiffCuentas s={s} prev={prev} totalDiff={diffBob} />
            ) : (
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
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Cambios cuenta por cuenta entre la foto anterior (`prev`) y la actual (`s`). */
function DiffCuentas({
  s,
  prev,
  totalDiff,
}: {
  s: SnapshotUI;
  prev: SnapshotUI | null;
  totalDiff: number | null;
}) {
  const contrib = (amount: number, currency: string, isLiab: boolean, rate: number) => {
    const bob = currency === "BOB" ? amount : amount * rate;
    return isLiab ? -bob : bob;
  };
  const ids = new Set<string>();
  s.balances.forEach((b) => ids.add(b.account_id));
  prev?.balances.forEach((b) => ids.add(b.account_id));

  const rows = [...ids]
    .map((id) => {
      const cur = s.balances.find((b) => b.account_id === id) ?? null;
      const pre = prev?.balances.find((b) => b.account_id === id) ?? null;
      const acc = (cur?.account ?? pre?.account)!;
      const curC = cur ? contrib(cur.amount, acc.currency, acc.is_liability, s.exchange_rate) : 0;
      const preC = pre ? contrib(pre.amount, acc.currency, acc.is_liability, prev?.exchange_rate ?? s.exchange_rate) : 0;
      return {
        id,
        acc,
        curAmount: cur?.amount ?? null,
        preAmount: pre?.amount ?? null,
        delta: Math.round((curC - preC) * 100) / 100,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const cambio = Math.abs(r.delta) >= 0.005;
        const sube = r.delta > 0;
        return (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{r.acc.name}</span>
              <Badge variant={r.acc.is_liability ? "destructive" : "secondary"}>{r.acc.currency}</Badge>
              {r.preAmount == null && <Badge variant="success">nueva</Badge>}
              {r.curAmount == null && <Badge variant="outline">removida</Badge>}
            </div>
            <div className="shrink-0 text-right">
              {cambio ? (
                <span className={cn("text-sm font-semibold tabular-nums", sube ? "text-primary" : "text-destructive")}>
                  {sube ? "+" : "−"}
                  {formatBob(Math.abs(r.delta))}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">sin cambio</span>
              )}
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {r.preAmount != null ? formatNumber(r.preAmount, 2) : "—"} →{" "}
                {r.curAmount != null ? formatNumber(r.curAmount, 2) : "—"} {r.acc.currency}
              </div>
            </div>
          </div>
        );
      })}
      {totalDiff != null && (
        <div className="mt-1 flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Cambio total</span>
          <span className={cn("tabular-nums", totalDiff >= 0 ? "text-primary" : "text-destructive")}>
            {totalDiff >= 0 ? "+" : "−"}
            {formatBob(Math.abs(totalDiff))}
          </span>
        </div>
      )}
    </div>
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
