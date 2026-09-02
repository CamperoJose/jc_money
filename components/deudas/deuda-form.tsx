"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBob } from "@/lib/format";
import type { Account, DebtStatus, DebtUI } from "@/lib/types";

/** Cuentas destino válidas para el ingreso de un cobro (reales, no derivadas). */
function cuentasDestino(cuentas: Account[]): Account[] {
  return cuentas.filter((c) => c.active && !c.is_liability && c.type !== "dpf" && c.type !== "por_cobrar");
}

function hoyInput(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function DeudaForm({
  registro,
  cuentas,
  open,
  onOpenChange,
}: {
  registro?: DebtUI | null;
  cuentas: Account[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;
  const destinos = useMemo(() => cuentasDestino(cuentas), [cuentas]);

  const [quien, setQuien] = useState(registro?.counterparty ?? "");
  const [fecha, setFecha] = useState(registro?.debt_date ?? hoyInput());
  const [monto, setMonto] = useState(registro ? String(registro.amount) : "");
  const [cobrado, setCobrado] = useState(registro ? String(registro.paid_amount) : "0");
  const [motivo, setMotivo] = useState(registro?.reason ?? "");
  const [vence, setVence] = useState(registro?.due_date ?? "");
  const [estado, setEstado] = useState<DebtStatus>(registro?.status ?? "pendiente");
  const [cuentaCobro, setCuentaCobro] = useState(registro?.paid_account_id ?? "");
  const [fechaCobro, setFechaCobro] = useState(registro?.collected_date ?? hoyInput());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoN = parseFloat(monto) || 0;
  const cobradoN = parseFloat(cobrado) || 0;
  const porCobrar = Math.max(0, Math.round((montoN - cobradoN) * 100) / 100);
  const hayCobro = cobradoN > 0;

  async function guardar() {
    setError(null);
    if (!(montoN > 0)) return setError("Ingresa un monto mayor a 0.");
    if (cobradoN < 0 || cobradoN > montoN) return setError("Lo cobrado debe estar entre 0 y el monto.");
    if (!fecha) return setError("Ingresa la fecha.");

    const payload = {
      debt_date: fecha,
      amount: montoN,
      paid_amount: cobradoN,
      reason: motivo,
      counterparty: quien,
      status: estado,
      due_date: vence || null,
      paid_account_id: hayCobro ? cuentaCobro || null : null,
      collected_date: hayCobro ? fechaCobro || null : null,
    };

    setEnviando(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = editando ? `/api/deudas/${registro!.id}` : "/api/deudas";
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          ? "La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo."
          : e instanceof Error
            ? e.message
            : "Error al guardar.";
      setError(msg);
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{editando ? "Editar deuda" : "Nueva deuda"}</DialogTitle>
        <DialogDescription>Registra un préstamo que te deben. Suma a tu patrimonio (por cobrar).</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="space-y-1.5">
          <Label htmlFor="quien">¿Quién te debe?</Label>
          <Input id="quien" value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Nombre" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha del préstamo</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vence">Fecha de cobro (opcional)</Label>
            <Input id="vence" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto total (Bs)</Label>
            <Input id="monto" type="number" step="0.01" min="0" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cobrado">Ya cobrado (Bs)</Label>
            <Input id="cobrado" type="number" step="0.01" min="0" inputMode="decimal" value={cobrado} onChange={(e) => setCobrado(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" value={estado} onChange={(e) => setEstado(e.target.value as DebtStatus)}>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado (cobrado)</option>
          </Select>
        </div>

        {hayCobro && (
          <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Cobro</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaCobro">¿Cuándo te pagaron?</Label>
              <Input id="fechaCobro" type="date" value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuentaCobro">Cuenta destino</Label>
              <Select id="cuentaCobro" value={cuentaCobro} onChange={(e) => setCuentaCobro(e.target.value)}>
                <option value="">— Sin cuenta (solo registrar) —</option>
                {destinos.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
                ))}
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              El job de medianoche mueve lo cobrado a esta cuenta el día del cobro.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="motivo">Motivo (opcional)</Label>
          <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Detalle del préstamo…" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
        <span className="text-sm text-muted-foreground">Por cobrar</span>
        <span className="text-base font-bold text-primary tabular-nums">{formatBob(porCobrar)}</span>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <Warning weight="fill" className="size-4" />
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
        <Button onClick={guardar} disabled={enviando}>
          <FloppyDisk weight="bold" className="size-4" />
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
