"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning } from "@phosphor-icons/react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBob, formatUsd } from "@/lib/format";
import type { Account } from "@/lib/types";
import type { SnapshotUI } from "@/lib/queries/patrimonio";

type Montos = Record<string, string>; // account_id -> valor de texto

function inicialMontos(cuentas: Account[], registro?: SnapshotUI | null): Montos {
  const m: Montos = {};
  for (const c of cuentas) m[c.id] = "";
  if (registro) {
    for (const b of registro.balances) m[b.account_id] = String(b.amount);
  }
  return m;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function RegistroForm({
  cuentas,
  registro,
  open,
  onOpenChange,
}: {
  cuentas: Account[];
  registro?: SnapshotUI | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;

  const [fecha, setFecha] = useState(registro?.snapshot_date ?? hoyISO());
  const [tc, setTc] = useState(registro ? String(registro.exchange_rate) : "9.60");
  const [nota, setNota] = useState(registro?.note ?? "");
  const [montos, setMontos] = useState<Montos>(() => inicialMontos(cuentas, registro));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = parseFloat(tc) || 0;

  // Vista previa del total en BOB con la misma regla del negocio.
  const totalBob = useMemo(() => {
    let t = 0;
    for (const c of cuentas) {
      const v = parseFloat(montos[c.id]);
      if (Number.isNaN(v)) continue;
      const enBob = c.currency === "BOB" ? v : v * rate;
      t += c.is_liability ? -enBob : enBob;
    }
    return Math.round(t * 100) / 100;
  }, [cuentas, montos, rate]);

  const totalUsd = rate ? Math.round((totalBob / rate) * 100) / 100 : 0;

  async function guardar() {
    setError(null);
    const balances = cuentas
      .map((c) => ({ account_id: c.id, amount: parseFloat(montos[c.id]) }))
      .filter((b) => !Number.isNaN(b.amount));

    if (balances.length === 0) {
      setError("Ingresa al menos un saldo.");
      return;
    }
    if (!rate || rate <= 0) {
      setError("El T/C debe ser mayor a 0.");
      return;
    }

    setEnviando(true);
    try {
      const url = editando ? `/api/patrimonio/snapshots/${registro!.id}` : "/api/patrimonio/snapshots";
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot_date: fecha,
          exchange_rate: rate,
          note: nota,
          balances,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setEnviando(false);
    }
  }

  const activos = cuentas.filter((c) => !c.is_liability);
  const pasivos = cuentas.filter((c) => c.is_liability);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{editando ? "Editar foto de patrimonio" : "Nueva foto de patrimonio"}</DialogTitle>
        <DialogDescription>
          Registra los saldos por cuenta en una fecha. El total se calcula automáticamente.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc">T/C (Bs por USD)</Label>
            <Input
              id="tc"
              type="number"
              step="0.01"
              min="0"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
            />
          </div>
        </div>

        <CamposCuentas titulo="Activos" cuentas={activos} montos={montos} setMontos={setMontos} />
        {pasivos.length > 0 && (
          <CamposCuentas titulo="Pasivos (se restan)" cuentas={pasivos} montos={montos} setMontos={setMontos} />
        )}

        <div className="space-y-1.5">
          <Label htmlFor="nota">Nota (opcional)</Label>
          <Input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Comentario…" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">Total calculado</span>
        <span className="text-right">
          <span className="block text-lg font-bold text-primary tabular-nums">{formatBob(totalBob)}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">{formatUsd(totalUsd)}</span>
        </span>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <Warning weight="fill" className="size-4" />
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={enviando}>
          <FloppyDisk weight="bold" className="size-4" />
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Crear registro"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function CamposCuentas({
  titulo,
  cuentas,
  montos,
  setMontos,
}: {
  titulo: string;
  cuentas: Account[];
  montos: Montos;
  setMontos: React.Dispatch<React.SetStateAction<Montos>>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="grid gap-2">
        {cuentas.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <Label htmlFor={`m-${c.id}`} className="flex flex-1 items-center gap-2 truncate">
              {c.name}
              <Badge variant="secondary" className="shrink-0">
                {c.currency}
              </Badge>
            </Label>
            <Input
              id={`m-${c.id}`}
              type="number"
              step="0.01"
              className="w-36"
              placeholder="0.00"
              value={montos[c.id] ?? ""}
              onChange={(e) => setMontos((m) => ({ ...m, [c.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
