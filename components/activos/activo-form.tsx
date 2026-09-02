"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning, TrendUp, TrendDown } from "@phosphor-icons/react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBob, formatPercent } from "@/lib/format";
import type { Account, AssetStatus, AssetUI, Currency } from "@/lib/types";

/** Cuentas destino válidas para el ingreso de una venta (reales, no derivadas). */
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

export function ActivoForm({
  registro,
  cuentas,
  open,
  onOpenChange,
}: {
  registro?: AssetUI | null;
  cuentas: Account[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;
  const destinos = useMemo(() => cuentasDestino(cuentas), [cuentas]);

  const [nombre, setNombre] = useState(registro?.name ?? "");
  const [categoria, setCategoria] = useState(registro?.category ?? "");
  const [adquirido, setAdquirido] = useState(registro?.acquired_date ?? hoyInput());
  const [costo, setCosto] = useState(registro ? String(registro.acquisition_cost) : "");
  const [moneda, setMoneda] = useState<Currency>(registro?.currency ?? "BOB");
  const [valorActual, setValorActual] = useState(registro?.current_value != null ? String(registro.current_value) : "");
  const [vendible, setVendible] = useState(registro?.sellable ?? true);
  const [cuenta, setCuenta] = useState(registro?.counts_in_patrimonio ?? true);
  const [estado, setEstado] = useState<AssetStatus>(registro?.status ?? "activo");
  const [fechaVenta, setFechaVenta] = useState(registro?.sold_date ?? hoyInput());
  const [precioVenta, setPrecioVenta] = useState(registro?.sold_price != null ? String(registro.sold_price) : "");
  const [cuentaVenta, setCuentaVenta] = useState(registro?.sold_account_id ?? "");
  const [notas, setNotas] = useState(registro?.notes ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costoN = parseFloat(costo) || 0;
  const vendido = estado === "vendido";

  const resultado = useMemo(() => {
    const base = vendido ? parseFloat(precioVenta) || 0 : parseFloat(valorActual) || costoN;
    if (!(costoN > 0)) return null;
    const r = Math.round((base - costoN) * 100) / 100;
    return { r, pct: r / costoN };
  }, [vendido, precioVenta, valorActual, costoN]);

  async function guardar() {
    setError(null);
    if (!nombre.trim()) return setError("Ingresa un nombre.");
    if (!(costoN >= 0)) return setError("El costo no puede ser negativo.");
    if (vendido && !(parseFloat(precioVenta) >= 0)) return setError("Ingresa el precio de venta.");
    if (vendido && !fechaVenta) return setError("Ingresa la fecha de venta.");

    const payload = {
      name: nombre,
      category: categoria,
      acquired_date: adquirido || null,
      acquisition_cost: costoN,
      currency: moneda,
      current_value: valorActual ? parseFloat(valorActual) : null,
      sellable: vendible,
      counts_in_patrimonio: cuenta,
      status: estado,
      sold_date: vendido ? fechaVenta : null,
      sold_price: vendido ? parseFloat(precioVenta) : null,
      sold_account_id: vendido ? cuentaVenta || null : null,
      notes: notas,
    };

    setEnviando(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = editando ? `/api/activos/${registro!.id}` : "/api/activos";
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
        <DialogTitle>{editando ? "Editar activo" : "Nuevo activo"}</DialogTitle>
        <DialogDescription>Un bien vendible (vehículo, equipo, etc.). Puede contar en tu patrimonio.</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Auto, laptop…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoría (opcional)</Label>
            <Input id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Vehículo, tecnología…" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adquirido">Fecha de adquisición</Label>
            <Input id="adquirido" type="date" value={adquirido} onChange={(e) => setAdquirido(e.target.value)} />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="costo">Costo</Label>
              <Input id="costo" type="number" step="0.01" min="0" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0.00" />
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
        </div>

        {!vendido && (
          <div className="space-y-1.5">
            <Label htmlFor="valorActual">Valor actual estimado ({moneda}, opcional)</Label>
            <Input id="valorActual" type="number" step="0.01" min="0" inputMode="decimal" value={valorActual} onChange={(e) => setValorActual(e.target.value)} placeholder="Si vacío, usa el costo" />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
            <Label className="cursor-pointer" htmlFor="vendible">¿Es vendible?</Label>
            <Switch id="vendible" checked={vendible} onChange={setVendible} />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
            <Label className="cursor-pointer" htmlFor="cuenta">¿Cuenta en patrimonio?</Label>
            <Switch id="cuenta" checked={cuenta} onChange={setCuenta} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" value={estado} onChange={(e) => setEstado(e.target.value as AssetStatus)}>
            <option value="activo">Activo (lo tengo)</option>
            <option value="vendido">Vendido</option>
          </Select>
        </div>

        {vendido && (
          <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Venta</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaVenta">Fecha de venta</Label>
              <Input id="fechaVenta" type="date" value={fechaVenta} onChange={(e) => setFechaVenta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precioVenta">Precio de venta ({moneda})</Label>
              <Input id="precioVenta" type="number" step="0.01" min="0" inputMode="decimal" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cuentaVenta">Cuenta destino (dónde ingresó el dinero)</Label>
              <Select id="cuentaVenta" value={cuentaVenta} onChange={(e) => setCuentaVenta(e.target.value)}>
                <option value="">— Sin cuenta (solo registrar) —</option>
                {destinos.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
                ))}
              </Select>
              <p className="text-[11px] text-muted-foreground">
                El job de medianoche mueve el importe a esta cuenta el día de la venta.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notas">Notas (opcional)</Label>
          <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalle del activo…" />
        </div>
      </div>

      {resultado && (
        <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {resultado.r >= 0 ? <TrendUp weight="bold" className="size-4 text-primary" /> : <TrendDown weight="bold" className="size-4 text-destructive" />}
            {vendido ? "Resultado de la venta" : "Plusvalía estimada"}
          </span>
          <span className={`text-base font-bold tabular-nums ${resultado.r >= 0 ? "text-primary" : "text-destructive"}`}>
            {resultado.r >= 0 ? "+" : ""}{formatBob(resultado.r)} ({formatPercent(resultado.pct, 1)})
          </span>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{error}</p>
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
