"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning, ArrowsClockwise } from "@phosphor-icons/react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatBob, formatUsd } from "@/lib/format";
import { fechaBoliviaHoy } from "@/lib/datetime";
import type { Account } from "@/lib/types";
import type { SnapshotUI } from "@/lib/queries/patrimonio";

type Montos = Record<string, string>; // account_id -> valor de texto

function inicialMontos(
  cuentas: Account[],
  registro?: SnapshotUI | null,
  ultimo?: SnapshotUI | null
): Montos {
  const m: Montos = {};
  for (const c of cuentas) m[c.id] = "";
  // Al editar: valores de esa foto. Al crear: copia los del último registro.
  const fuente = registro ?? ultimo;
  if (fuente) {
    for (const b of fuente.balances) m[b.account_id] = String(b.amount);
  }
  return m;
}

function hoyISO() {
  // Fecha de HOY en zona Bolivia (no UTC). Con toISOString(), después de las
  // 20:00 de Bolivia la fecha saltaba al día siguiente y desordenaba las fotos.
  return fechaBoliviaHoy();
}

export function RegistroForm({
  cuentas,
  registro,
  ultimo,
  open,
  onOpenChange,
}: {
  cuentas: Account[];
  registro?: SnapshotUI | null;
  ultimo?: SnapshotUI | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;

  const [fecha, setFecha] = useState(registro?.snapshot_date ?? hoyISO());
  // Al crear, arranca con el T/C del último registro (luego el efecto lo refresca
  // con el T/C del BCB de esa fecha, si existe). Editando: el de esa foto.
  const [tc, setTc] = useState(
    registro ? String(registro.exchange_rate) : ultimo ? String(ultimo.exchange_rate) : ""
  );
  const [nota, setNota] = useState(registro?.note ?? "");
  const [montos, setMontos] = useState<Montos>(() => inicialMontos(cuentas, registro, ultimo));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tcInfo, setTcInfo] = useState<string | null>(null);
  const [tcCargando, setTcCargando] = useState(false);

  const rate = parseFloat(tc) || 0;

  // Prellena el T/C con el último registro del BCB de esa fecha (editable).
  // Solo en alta (no al editar una foto existente).
  useEffect(() => {
    if (editando || !fecha) return;
    let cancelado = false;
    setTcCargando(true);
    fetch(`/api/tipo-cambio/ultimo?date=${fecha}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { rate: { valor: number; rate_date: string; moneda_desc: string | null } | null }) => {
        if (cancelado) return;
        if (j.rate) {
          setTc(String(j.rate.valor));
          setTcInfo(
            `T/C del BCB ${j.rate.rate_date}${j.rate.moneda_desc ? ` · ${j.rate.moneda_desc}` : ""}`
          );
        } else {
          setTcInfo("Sin T/C del BCB para esa fecha; ingrésalo manualmente.");
        }
      })
      .catch(() => !cancelado && setTcInfo(null))
      .finally(() => !cancelado && setTcCargando(false));
    return () => {
      cancelado = true;
    };
  }, [fecha, editando]);

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
    // Nunca se queda colgado: aborta a los 20s y muestra el error.
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = editando ? `/api/patrimonio/snapshots/${registro!.id}` : "/api/patrimonio/snapshots";
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_date: fecha, exchange_rate: rate, note: nota, balances }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      clearTimeout(timeout);
      setEnviando(false);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      clearTimeout(timeout);
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "La solicitud tardó demasiado. Revisa tu conexión con Supabase e inténtalo de nuevo."
          : e instanceof Error
            ? e.message
            : "Error al guardar.";
      setError(msg);
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
          {!editando && ultimo ? " Se copiaron los valores del último registro; ajusta lo que cambió." : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc" className="flex items-center gap-1.5">
              T/C (Bs por USD)
              {tcCargando && <ArrowsClockwise weight="bold" className="size-3 animate-spin text-muted-foreground" />}
            </Label>
            <Input
              id="tc"
              type="number"
              step="0.00001"
              min="0"
              placeholder="0.00"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
            />
            {tcInfo && <p className="text-[11px] text-muted-foreground">{tcInfo}</p>}
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
