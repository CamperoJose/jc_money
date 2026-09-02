"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, Warning, CalendarBlank } from "@phosphor-icons/react";
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
import { formatBob, formatDate } from "@/lib/format";
import { sumarDias, interesBruto, interesLiquido, redondeaTasa } from "@/lib/dpf";
import type { Account, DpfDeposit, DpfStatus } from "@/lib/types";

const PLAZOS = [30, 60, 90, 120, 180, 270, 360, 720];

/** Convierte una fracción (0.066) a texto de % sin ruido de float ("6.6"). */
function tasaAInput(fraccion: number): string {
  const pct = redondeaTasa(fraccion) * 100;
  // Redondea a 4 decimales de % y quita ceros/coma sobrantes.
  return String(Math.round(pct * 10000) / 10000);
}

export function DpfForm({
  cuentas,
  registro,
  open,
  onOpenChange,
}: {
  cuentas: Account[];
  registro?: DpfDeposit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const editando = !!registro;

  const [pizarra, setPizarra] = useState(registro?.pizarra ?? "");
  const [idDpf, setIdDpf] = useState(registro?.id_dpf_externo ?? "");
  const [inicio, setInicio] = useState(registro?.start_date ?? hoyInput());
  const [plazo, setPlazo] = useState(String(registro?.term_days ?? 90));
  const [monto, setMonto] = useState(registro ? String(registro.principal) : "");
  const [tasa, setTasa] = useState(registro ? tasaAInput(registro.annual_rate) : "");
  const [estado, setEstado] = useState<DpfStatus>(registro?.status ?? "activo");
  const [cobraIva, setCobraIva] = useState(registro?.cobra_iva ?? false);
  const [cuentaCobro, setCuentaCobro] = useState(registro?.paid_account_id ?? "");
  const [fechaCobro, setFechaCobro] = useState(registro?.paid_at ?? hoyInput());
  const [notas, setNotas] = useState(registro?.notes ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plazoNum = parseInt(plazo, 10) || 0;
  const finCalculado = useMemo(
    () => (inicio && plazoNum > 0 ? sumarDias(inicio, plazoNum) : null),
    [inicio, plazoNum]
  );

  const proyeccion = useMemo(() => {
    const principal = parseFloat(monto);
    const rate = redondeaTasa((parseFloat(tasa) || 0) / 100);
    if (!(principal > 0) || !(rate > 0) || !(plazoNum > 0)) return null;
    const bruto = interesBruto(principal, rate, plazoNum);
    const liquido = interesLiquido(bruto, cobraIva);
    return { bruto, liquido, rcIva: Math.round((bruto - liquido) * 100) / 100, total: principal + liquido };
  }, [monto, tasa, plazoNum, cobraIva]);

  async function guardar() {
    setError(null);
    const principal = parseFloat(monto);
    const rate = redondeaTasa((parseFloat(tasa) || 0) / 100);
    if (!(principal > 0)) return setError("Ingresa un capital mayor a 0.");
    if (!(rate > 0 && rate <= 1)) return setError("Ingresa una tasa anual válida (ej. 7.7).");
    if (!(plazoNum > 0)) return setError("Selecciona un plazo válido.");
    if (!inicio) return setError("Ingresa la fecha de inicio.");

    const payload = {
      pizarra,
      id_dpf_externo: idDpf,
      start_date: inicio,
      term_days: plazoNum,
      principal,
      annual_rate: rate,
      status: estado,
      cobra_iva: cobraIva,
      paid_account_id: estado === "pagado" ? cuentaCobro || null : null,
      paid_at: estado === "pagado" ? fechaCobro || null : null,
      notes: notas,
    };

    setEnviando(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = editando ? `/api/inversiones/dpf/${registro!.id}` : "/api/inversiones/dpf";
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
        <DialogTitle>{editando ? "Editar DPF" : "Nuevo DPF"}</DialogTitle>
        <DialogDescription>
          Registra un depósito a plazo fijo. La fecha de fin y los intereses se calculan solos.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {/* Entidad + Nº DPF */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pizarra">Entidad (pizarra)</Label>
            <Input
              id="pizarra"
              value={pizarra}
              onChange={(e) => setPizarra(e.target.value)}
              placeholder="Banco SOL, Fortaleza…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idDpf">Nº de DPF (opcional)</Label>
            <Input
              id="idDpf"
              value={idDpf}
              onChange={(e) => setIdDpf(e.target.value)}
              placeholder="3000164272"
            />
          </div>
        </div>

        {/* Inicio + Plazo */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inicio">Fecha de inicio</Label>
            <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plazo">Plazo (días)</Label>
            <Select id="plazo" value={plazo} onChange={(e) => setPlazo(e.target.value)}>
              {PLAZOS.map((p) => (
                <option key={p} value={p}>
                  {p} días
                </option>
              ))}
              {!PLAZOS.includes(plazoNum) && plazoNum > 0 && (
                <option value={plazoNum}>{plazoNum} días</option>
              )}
            </Select>
          </div>
        </div>

        {finCalculado && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <CalendarBlank weight="duotone" className="size-4" />
            Vence el <span className="font-medium text-foreground">{formatDate(finCalculado)}</span>
          </div>
        )}

        {/* Monto + Tasa */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="monto">Capital (Bs)</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="8000.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tasa">Tasa anual (%)</Label>
            <Input
              id="tasa"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="7.70"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
            />
          </div>
        </div>

        {/* Cobra IVA (RC-IVA 13%) */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
          <div className="pr-3">
            <Label className="cursor-pointer" htmlFor="cobraIva">
              ¿Cobra IVA (RC-IVA 13%)?
            </Label>
            <p className="text-xs text-muted-foreground">
              {cobraIva
                ? "Se retiene 13% sobre el interés (líquido = bruto · 0,87)."
                : "Sin retención: el interés líquido es igual al bruto."}
            </p>
          </div>
          <Switch id="cobraIva" checked={cobraIva} onChange={setCobraIva} />
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" value={estado} onChange={(e) => setEstado(e.target.value as DpfStatus)}>
            <option value="activo">Activo</option>
            <option value="pagado">Cobrado (pagado)</option>
          </Select>
        </div>

        {/* Declaración de cobro (solo si está pagado) */}
        {estado === "pagado" && (
          <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Declaración de cobro
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuentaCobro">¿A qué cuenta se cobró?</Label>
              <Select
                id="cuentaCobro"
                value={cuentaCobro}
                onChange={(e) => setCuentaCobro(e.target.value)}
              >
                <option value="">— Selecciona cuenta —</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaCobro">Fecha de cobro</Label>
              <Input
                id="fechaCobro"
                type="date"
                value={fechaCobro}
                onChange={(e) => setFechaCobro(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="space-y-1.5">
          <Label htmlFor="notas">Notas (opcional)</Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Detalle del depósito…"
          />
        </div>
      </div>

      {/* Proyección de intereses */}
      {proyeccion && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-4">
          <Metrica label="Interés bruto" valor={formatBob(proyeccion.bruto)} />
          <Metrica label="RC-IVA (13%)" valor={`− ${formatBob(proyeccion.rcIva)}`} />
          <Metrica label="Interés líquido" valor={formatBob(proyeccion.liquido)} destacado />
          <Metrica label="Al vencimiento" valor={formatBob(proyeccion.total)} destacado />
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
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar DPF"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Metrica({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${destacado ? "text-primary" : ""}`}>{valor}</div>
    </div>
  );
}

function hoyInput(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
