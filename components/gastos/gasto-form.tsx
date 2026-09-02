"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning, Clock, TrendDown, TrendUp } from "@phosphor-icons/react";
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
import { ahoraLocalInput, isoALocalInput, localInputAIso } from "@/lib/datetime";
import type { Account, Category, Currency, Participant, TransactionUI, TxnType } from "@/lib/types";

export function GastoForm({
  cuentas,
  categorias,
  participantes,
  registro,
  open,
  onOpenChange,
}: {
  cuentas: Account[];
  categorias: Category[];
  participantes: Participant[];
  registro?: TransactionUI | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;

  const [tipo, setTipo] = useState<TxnType>(registro?.type ?? "gasto");
  const [cuando, setCuando] = useState(
    registro ? isoALocalInput(registro.occurred_at) : ahoraLocalInput()
  );
  const [monto, setMonto] = useState(registro ? String(registro.amount) : "");
  const [moneda, setMoneda] = useState<Currency>(registro?.currency ?? "BOB");
  const [tc, setTc] = useState(registro?.exchange_rate ? String(registro.exchange_rate) : "9.60");
  const [cuentaId, setCuentaId] = useState(registro?.account_id ?? "");
  const [categoriaId, setCategoriaId] = useState(registro?.category_id ?? "");
  const [participanteId, setParticipanteId] = useState(registro?.participant_id ?? "");
  const [descripcion, setDescripcion] = useState(registro?.description ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categorías del tipo actual (gasto/ingreso). Las de inversión no aplican aquí.
  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.kind === tipo && c.active),
    [categorias, tipo]
  );

  const montoBob = useMemo(() => {
    const v = parseFloat(monto);
    if (Number.isNaN(v)) return 0;
    if (moneda === "BOB") return v;
    const r = parseFloat(tc) || 0;
    return Math.round(v * r * 100) / 100;
  }, [monto, moneda, tc]);

  async function guardar() {
    setError(null);
    const amount = parseFloat(monto);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Ingresa un monto mayor a 0.");
      return;
    }
    if (moneda !== "BOB" && (!(parseFloat(tc) > 0))) {
      setError("Con moneda distinta a BOB, el T/C es obligatorio.");
      return;
    }

    const payload = {
      occurred_at: localInputAIso(cuando),
      type: tipo,
      amount,
      currency: moneda,
      exchange_rate: moneda === "BOB" ? null : parseFloat(tc),
      account_id: cuentaId || null,
      category_id: categoriaId || null,
      participant_id: participanteId || null,
      description: descripcion,
    };

    setEnviando(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = editando
        ? `/api/gastos/transacciones/${registro!.id}`
        : "/api/gastos/transacciones";
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

  const esGasto = tipo === "gasto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{editando ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
        <DialogDescription>
          Registra un {esGasto ? "gasto" : "ingreso"}. La hora se guarda en zona de Bolivia (GMT-4).
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {/* Tipo: gasto / ingreso */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTipo("gasto")}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              esGasto ? "bg-destructive text-destructive-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <TrendDown weight="bold" className="size-4" />
            Gasto
          </button>
          <button
            type="button"
            onClick={() => setTipo("ingreso")}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              !esGasto ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <TrendUp weight="bold" className="size-4" />
            Ingreso
          </button>
        </div>

        {/* Fecha y hora */}
        <div className="space-y-1.5">
          <Label htmlFor="cuando">Fecha y hora</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="cuando"
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setCuando(ahoraLocalInput())}
              className="shrink-0"
            >
              <Clock weight="bold" className="size-4" />
              En este momento
            </Button>
          </div>
        </div>

        {/* Monto + moneda */}
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="moneda">Moneda</Label>
            <Select id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
              <option value="BOB">BOB</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
            </Select>
          </div>
        </div>

        {moneda !== "BOB" && (
          <div className="space-y-1.5">
            <Label htmlFor="tc">T/C (Bs por {moneda})</Label>
            <Input
              id="tc"
              type="number"
              step="0.01"
              min="0"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
            />
          </div>
        )}

        {/* Cuenta de salida */}
        <div className="space-y-1.5">
          <Label htmlFor="cuenta">{esGasto ? "Cuenta de salida" : "Cuenta de ingreso"}</Label>
          <Select id="cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">— Sin cuenta —</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.currency})
              </option>
            ))}
          </Select>
        </div>

        {/* Categoría + participante */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">— Sin categoría —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="participante">Participante</Label>
            <Select
              id="participante"
              value={participanteId}
              onChange={(e) => setParticipanteId(e.target.value)}
            >
              <option value="">— Sin participante —</option>
              {participantes
                .filter((p) => p.active || p.id === participanteId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción (opcional)</Label>
          <Textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalle del movimiento…"
          />
        </div>
      </div>

      {moneda !== "BOB" && (
        <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Equivalente en BOB</span>
          <span className="text-base font-bold text-primary tabular-nums">{formatBob(montoBob)}</span>
        </div>
      )}

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
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
