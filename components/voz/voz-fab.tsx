"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Microphone,
  Stop,
  X,
  FloppyDisk,
  Warning,
  Trash,
  Receipt,
  HandCoins,
  CircleNotch,
} from "@phosphor-icons/react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fechaBoliviaHoy } from "@/lib/datetime";
import type { Account, Category, Currency } from "@/lib/types";
import type { DeudaVoz, GastoVoz } from "@/lib/voz/tipos";

type Estado = "idle" | "grabando" | "procesando" | "revision";

interface GastoEd extends GastoVoz {
  _id: string;
  exchange_rate: string;
}
interface DeudaEd extends DeudaVoz {
  _id: string;
}

let contador = 0;
const nid = () => `v${Date.now()}_${contador++}`;

/** Elige un mimeType de grabación soportado por el navegador. */
function elegirMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const m of candidatos) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return "";
}

export function VozFab({ cuentas, categorias }: { cuentas: Account[]; categorias: Category[] }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gastos, setGastos] = useState<GastoEd[]>([]);
  const [deudas, setDeudas] = useState<DeudaEd[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [tcDefault, setTcDefault] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cuentasAct = cuentas.filter((c) => c.active);

  const limpiarStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => limpiarStream(), [limpiarStream]);

  // T/C de referencia para prellenar montos en moneda extranjera.
  useEffect(() => {
    fetch(`/api/tipo-cambio/ultimo?date=${fechaBoliviaHoy()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.rate && setTcDefault(String(j.rate)))
      .catch(() => {});
  }, []);

  async function iniciar() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = elegirMime();
      mimeRef.current = (mime || "audio/webm").split(";")[0];
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        limpiarStream();
        void enviar(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setSegundos(0);
      setEstado("grabando");
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          if (s >= 59) detener(); // corte de seguridad a 60s
          return s + 1;
        });
      }, 1000);
    } catch {
      limpiarStream();
      setError("No se pudo acceder al micrófono. Revisa los permisos.");
      setEstado("idle");
    }
  }

  function detener() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setEstado("procesando");
  }

  function cancelar() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    limpiarStream();
    setEstado("idle");
  }

  async function enviar(blob: Blob) {
    try {
      const audioBase64 = await blobABase64(blob);
      const res = await fetch("/api/voz/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: mimeRef.current }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);

      const gs: GastoEd[] = (j.gastos ?? []).map((g: GastoVoz) => ({
        ...g,
        _id: nid(),
        exchange_rate: g.moneda === "BOB" ? "" : tcDefault,
      }));
      const ds: DeudaEd[] = (j.deudas ?? []).map((d: DeudaVoz) => ({ ...d, _id: nid() }));

      if (gs.length === 0 && ds.length === 0) {
        setError("No se detectó ningún gasto ni deuda. Intenta de nuevo, más claro.");
        setEstado("idle");
        return;
      }
      setGastos(gs);
      setDeudas(ds);
      setEstado("revision");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al interpretar el audio.");
      setEstado("idle");
    }
  }

  function setGasto(id: string, campo: keyof GastoEd, valor: string) {
    setGastos((xs) => xs.map((g) => (g._id === id ? { ...g, [campo]: valor } : g)));
  }
  function setDeuda(id: string, campo: keyof DeudaEd, valor: string) {
    setDeudas((xs) => xs.map((d) => (d._id === id ? { ...d, [campo]: valor } : d)));
  }

  async function registrar() {
    setError(null);
    // Validación cliente.
    for (const g of gastos) {
      if (!(Number(g.monto) > 0)) return setError("Cada gasto necesita un monto mayor a 0.");
      if (g.moneda !== "BOB" && !(parseFloat(g.exchange_rate) > 0)) {
        return setError("Con moneda distinta a BOB, indica el tipo de cambio.");
      }
    }
    for (const d of deudas) {
      if (!(Number(d.monto) > 0)) return setError("Cada deuda necesita un monto mayor a 0.");
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/voz/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gastos: gastos.map((g) => ({
            descripcion: g.descripcion,
            monto: Number(g.monto),
            moneda: g.moneda,
            exchange_rate: g.moneda === "BOB" ? null : parseFloat(g.exchange_rate),
            cuenta_id: g.cuenta_id,
            categoria_id: g.categoria_id,
          })),
          deudas: deudas.map((d) => ({
            quien: d.quien,
            monto: Number(d.monto),
            motivo: d.motivo,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
      cerrarRevision();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar.");
    } finally {
      setGuardando(false);
    }
  }

  function cerrarRevision() {
    setGastos([]);
    setDeudas([]);
    setEstado("idle");
  }

  const procesando = estado === "procesando";

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={estado === "grabando" ? detener : estado === "idle" ? iniciar : undefined}
        disabled={procesando}
        aria-label={estado === "grabando" ? "Detener grabación" : "Registrar por voz"}
        title="Registrar gasto o deuda por voz"
        className={[
          "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full shadow-lg transition-all",
          "h-14 px-4 text-primary-foreground",
          estado === "grabando"
            ? "bg-destructive hover:bg-destructive/90 animate-pulse"
            : "bg-primary hover:bg-primary/90",
          procesando ? "opacity-80" : "",
        ].join(" ")}
      >
        {procesando ? (
          <CircleNotch weight="bold" className="size-6 animate-spin" />
        ) : estado === "grabando" ? (
          <>
            <Stop weight="fill" className="size-6" />
            <span className="font-semibold tabular-nums">{fmt(segundos)}</span>
          </>
        ) : (
          <Microphone weight="fill" className="size-6" />
        )}
      </button>

      {/* Aviso de grabación / error flotante */}
      {estado === "grabando" && (
        <div className="fixed bottom-24 right-6 z-40 rounded-lg bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
          Grabando… toca para detener
          <button onClick={cancelar} className="ml-2 font-medium text-destructive">Cancelar</button>
        </div>
      )}
      {error && estado === "idle" && (
        <div className="fixed bottom-24 right-6 z-40 flex max-w-xs items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-md">
          <Warning weight="fill" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Cerrar"><X className="size-3.5" /></button>
        </div>
      )}

      {/* Revisión */}
      <Dialog open={estado === "revision"} onOpenChange={(v) => !v && !guardando && cerrarRevision()}>
        <DialogHeader>
          <DialogTitle>Revisar y confirmar</DialogTitle>
          <DialogDescription>
            Esto entendí de tu voz. Corrige lo que haga falta antes de registrar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {gastos.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Receipt weight="duotone" className="size-4" /> Gastos ({gastos.length})
              </p>
              {gastos.map((g) => (
                <div key={g._id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={g.descripcion}
                      onChange={(e) => setGasto(g._id, "descripcion", e.target.value)}
                      placeholder="Descripción"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setGastos((xs) => xs.filter((x) => x._id !== g._id))} aria-label="Quitar">
                      <Trash className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_5rem] gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Monto</Label>
                      <Input type="number" step="0.01" min="0" inputMode="decimal" value={g.monto ?? ""} onChange={(e) => setGasto(g._id, "monto", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Moneda</Label>
                      <Select value={g.moneda} onChange={(e) => setGasto(g._id, "moneda", e.target.value as Currency)}>
                        <option value="BOB">BOB</option>
                        <option value="USD">USD</option>
                        <option value="USDT">USDT</option>
                      </Select>
                    </div>
                  </div>
                  {g.moneda !== "BOB" && (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Tipo de cambio (Bs por {g.moneda})</Label>
                      <Input type="number" step="0.0001" min="0" inputMode="decimal" value={g.exchange_rate} onChange={(e) => setGasto(g._id, "exchange_rate", e.target.value)} placeholder="0.00" />
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Cuenta</Label>
                      <Select value={g.cuenta_id ?? ""} onChange={(e) => setGasto(g._id, "cuenta_id", e.target.value)}>
                        <option value="">— Sin cuenta —</option>
                        {cuentasAct.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Categoría</Label>
                      <Select value={g.categoria_id ?? ""} onChange={(e) => setGasto(g._id, "categoria_id", e.target.value)}>
                        <option value="">— Sin categoría —</option>
                        {categorias.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deudas.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <HandCoins weight="duotone" className="size-4" /> Deudas que me deben ({deudas.length})
              </p>
              {deudas.map((d) => (
                <div key={d._id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Input value={d.quien ?? ""} onChange={(e) => setDeuda(d._id, "quien", e.target.value)} placeholder="¿Quién te debe?" className="flex-1" />
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeudas((xs) => xs.filter((x) => x._id !== d._id))} aria-label="Quitar">
                      <Trash className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Monto (Bs)</Label>
                      <Input type="number" step="0.01" min="0" inputMode="decimal" value={d.monto ?? ""} onChange={(e) => setDeuda(d._id, "monto", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Motivo</Label>
                      <Input value={d.motivo ?? ""} onChange={(e) => setDeuda(d._id, "motivo", e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && estado === "revision" && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <Warning weight="fill" className="size-4" />{error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={cerrarRevision} disabled={guardando}>Cancelar</Button>
          <Button onClick={registrar} disabled={guardando || (gastos.length === 0 && deudas.length === 0)}>
            <FloppyDisk weight="bold" className="size-4" />
            {guardando ? "Registrando…" : "Registrar todo"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result);
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el audio."));
    reader.readAsDataURL(blob);
  });
}
