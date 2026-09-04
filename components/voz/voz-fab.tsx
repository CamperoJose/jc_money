"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Microphone, Stop, X, Warning, CircleNotch, CheckCircle } from "@phosphor-icons/react";

type Estado = "idle" | "grabando" | "enviando" | "ok" | "error";

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

/**
 * Botón flotante de registro por voz. Graba audio y lo envía a /api/voz/ingesta,
 * que responde de inmediato ("registro recibido") y procesa en segundo plano;
 * el usuario recibe el detalle por correo. Sin menú de revisión.
 */
export function VozFab() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");
  const [segundos, setSegundos] = useState(0);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const okTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Libera el micrófono por completo (apaga el indicador). Solo al desmontar o
  // tras un rato de inactividad, no entre grabaciones (así no se re-pide permiso).
  const soltarMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const pararTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Devuelve un stream de micrófono reutilizable: si ya se otorgó el permiso y
  // el track sigue vivo, se reutiliza (iOS/Safari no vuelve a preguntar).
  const obtenerStream = useCallback(async (): Promise<MediaStream> => {
    const actual = streamRef.current;
    if (actual && actual.getAudioTracks().some((t) => t.readyState === "live")) return actual;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }, []);

  useEffect(
    () => () => {
      pararTimer();
      soltarMic();
      if (okTimerRef.current) clearTimeout(okTimerRef.current);
      if (idleRef.current) clearTimeout(idleRef.current);
    },
    [pararTimer, soltarMic]
  );

  async function iniciar() {
    setMensaje(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEstado("error");
      setMensaje("Tu navegador no permite grabar audio.");
      return;
    }
    if (idleRef.current) clearTimeout(idleRef.current); // no sueltes el mic mientras se usa
    try {
      const stream = await obtenerStream();
      const mime = elegirMime();
      mimeRef.current = (mime || "audio/webm").split(";")[0];
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        pararTimer();
        // Conserva el permiso reutilizando el stream; suéltalo si queda inactivo.
        if (idleRef.current) clearTimeout(idleRef.current);
        idleRef.current = setTimeout(soltarMic, 120_000);
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
      pararTimer();
      soltarMic();
      setEstado("error");
      setMensaje("No se pudo acceder al micrófono. Revisa los permisos.");
    }
  }

  function detener() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    pararTimer();
    setEstado("enviando");
  }

  function cancelar() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    pararTimer();
    // Mantén el permiso: suelta el mic solo tras inactividad.
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(soltarMic, 120_000);
    setEstado("idle");
  }

  async function enviar(blob: Blob) {
    try {
      const audioBase64 = await blobABase64(blob);
      const res = await fetch("/api/voz/ingesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: mimeRef.current, origen: "app" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? j.message ?? `Error ${res.status}`);
      // j.ok === false → se procesó pero no se registró (faltó un dato).
      if (j.ok === false) {
        setEstado("error");
        setMensaje(j.message ?? "No se registró: faltó un dato.");
        return;
      }
      setEstado("ok");
      setMensaje(j.message ?? "Registrado. Te enviamos un correo con el detalle.");
      okTimerRef.current = setTimeout(() => {
        setEstado("idle");
        setMensaje(null);
      }, 6000);
      router.refresh();
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : "Error al enviar el audio.");
    }
  }

  const enviando = estado === "enviando";
  const grabando = estado === "grabando";

  return (
    <>
      <button
        type="button"
        onClick={grabando ? detener : estado === "idle" || estado === "ok" || estado === "error" ? iniciar : undefined}
        disabled={enviando}
        aria-label={grabando ? "Detener grabación" : "Registrar por voz"}
        title="Registrar gasto o deuda por voz"
        className={[
          "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40",
          // Botón flotante: sobre él pasa todo el contenido al desplazar, así
          // que aquí el vidrio sí aporta. El degradado y el filo interior le dan
          // relieve para que no se pierda sobre fondos claros.
          "flex h-14 items-center gap-2 rounded-full px-4 text-primary-foreground shadow-lg ring-1 ring-inset ring-white/20 backdrop-blur-xl backdrop-saturate-150 transition-all active:scale-95",
          "bg-gradient-to-b from-white/25 to-transparent",
          grabando
            ? "animate-pulse bg-destructive/85 hover:bg-destructive"
            : "bg-primary/85 hover:bg-primary",
          enviando ? "opacity-80" : "",
        ].join(" ")}
      >
        {enviando ? (
          <CircleNotch weight="bold" className="size-6 animate-spin" />
        ) : estado === "ok" ? (
          <CheckCircle weight="fill" className="size-6" />
        ) : grabando ? (
          <>
            <Stop weight="fill" className="size-6" />
            <span className="font-semibold tabular-nums">{fmt(segundos)}</span>
          </>
        ) : (
          <Microphone weight="fill" className="size-6" />
        )}
      </button>

      {grabando && (
        <div className="vidrio fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground shadow-md">
          Grabando… toca para enviar
          <button onClick={cancelar} className="ml-2 font-medium text-destructive">Cancelar</button>
        </div>
      )}

      {mensaje && (estado === "ok" || estado === "error") && (
        <div
          className={[
            "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 flex max-w-xs items-start gap-1.5 rounded-lg px-3 py-2 text-xs shadow-md",
            estado === "ok" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
          ].join(" ")}
        >
          {estado === "ok" ? (
            <CheckCircle weight="fill" className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Warning weight="fill" className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{mensaje}</span>
          <button onClick={() => { setEstado("idle"); setMensaje(null); }} aria-label="Cerrar">
            <X className="size-3.5" />
          </button>
        </div>
      )}
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
