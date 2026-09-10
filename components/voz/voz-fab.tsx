"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAvisos } from "@/components/ui/toast";
import { Microphone, Stop, X, Warning, CircleNotch, CheckCircle } from "@phosphor-icons/react";

type Estado = "idle" | "grabando" | "enviando" | "ok" | "error";

const UMBRAL_VOZ = 0.008;
const FRAMES_VOZ_REQUERIDOS = 8;

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

export function VozFab() {
  const router = useRouter();
  const avisos = useAvisos();
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const framesVozRef = useRef(0);

  const detenerAnalisis = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const iniciarAnalisis = useCallback((stream: MediaStream) => {
    try {
      const contexto = new AudioContext();
      const analyser = contexto.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      const source = contexto.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = contexto;
      analyserRef.current = analyser;
      framesVozRef.current = 0;

      const datos = new Float32Array(analyser.fftSize);
      const analizar = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(datos);
        let suma = 0;
        for (const muestra of datos) suma += muestra * muestra;
        const rms = Math.sqrt(suma / datos.length);
        if (rms >= UMBRAL_VOZ) framesVozRef.current += 1;
        rafRef.current = requestAnimationFrame(analizar);
      };
      rafRef.current = requestAnimationFrame(analizar);
      void contexto.resume().catch(() => {});
    } catch {
      // El análisis es una defensa adicional. Si el navegador no soporta Web Audio,
      // Gemini mantiene la validación estricta del audio como segunda barrera.
    }
  }, []);

  const soltarMic = useCallback(() => {
    detenerAnalisis();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [detenerAnalisis]);

  const pararTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const obtenerStream = useCallback(async (): Promise<MediaStream> => {
    const actual = streamRef.current;
    if (actual && actual.getAudioTracks().some((t) => t.readyState === "live")) return actual;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }, []);

  useEffect(() => () => {
    pararTimer();
    soltarMic();
    if (okTimerRef.current) clearTimeout(okTimerRef.current);
    if (idleRef.current) clearTimeout(idleRef.current);
  }, [pararTimer, soltarMic]);

  async function iniciar() {
    setMensaje(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEstado("error");
      setMensaje("Tu navegador no permite grabar audio.");
      return;
    }
    if (idleRef.current) clearTimeout(idleRef.current);
    try {
      const stream = await obtenerStream();
      const mime = elegirMime();
      mimeRef.current = (mime || "audio/webm").split(";")[0];
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      framesVozRef.current = 0;
      iniciarAnalisis(stream);

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const huboVoz = framesVozRef.current >= FRAMES_VOZ_REQUERIDOS;
        detenerAnalisis();
        pararTimer();
        if (idleRef.current) clearTimeout(idleRef.current);
        idleRef.current = setTimeout(soltarMic, 120_000);

        if (!huboVoz) {
          setEstado("error");
          setMensaje("No se detectó voz clara. No se envió ni registró ningún movimiento.");
          return;
        }
        void enviar(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setSegundos(0);
      setEstado("grabando");
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          if (s >= 59) detener();
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
    detenerAnalisis();
    pararTimer();
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(soltarMic, 120_000);
    setEstado("idle");
  }

  async function enviar(blob: Blob) {
    try {
      if (blob.size <= 0) {
        setEstado("error");
        setMensaje("La grabación está vacía. No se envió ni registró ningún movimiento.");
        return;
      }
      const audioBase64 = await blobABase64(blob);
      if (!audioBase64.trim()) {
        setEstado("error");
        setMensaje("No se pudo obtener contenido del audio. No se registró ningún movimiento.");
        return;
      }
      const res = await fetch("/api/voz/ingesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: mimeRef.current, origen: "app" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? j.message ?? `Error ${res.status}`);
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
      avisos.exito("Registro recibido", "Se está procesando; te llega un correo con el detalle.");
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
        title="Registrar gasto, ingreso o deuda por voz"
        className={[
          "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40",
          "flex h-14 items-center gap-2 rounded-full px-4 text-primary-foreground shadow-lg ring-1 ring-inset ring-white/20 backdrop-blur-xl backdrop-saturate-150 transition-all active:scale-95",
          "bg-gradient-to-b from-white/25 to-transparent",
          grabando ? "animate-pulse bg-destructive/85 hover:bg-destructive" : "bg-primary/85 hover:bg-primary",
          enviando ? "opacity-80" : "",
        ].join(" ")}
      >
        {enviando ? <CircleNotch weight="bold" className="size-6 animate-spin" /> : estado === "ok" ? <CheckCircle weight="fill" className="size-6" /> : grabando ? <><Stop weight="fill" className="size-6" /><span className="font-semibold tabular-nums">{fmt(segundos)}</span></> : <Microphone weight="fill" className="size-6" />}
      </button>

      {grabando && (
        <div className="vidrio fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground shadow-md">
          Grabando… toca para enviar
          <button onClick={cancelar} className="ml-2 font-medium text-destructive">Cancelar</button>
        </div>
      )}

      {mensaje && (estado === "ok" || estado === "error") && (
        <div className={["fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 flex max-w-xs items-start gap-1.5 rounded-lg px-3 py-2 text-xs shadow-md", estado === "ok" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"].join(" ")}>
          {estado === "ok" ? <CheckCircle weight="fill" className="mt-0.5 size-3.5 shrink-0" /> : <Warning weight="fill" className="mt-0.5 size-3.5 shrink-0" />}
          <span>{mensaje}</span>
          <button onClick={() => { setEstado("idle"); setMensaje(null); }} aria-label="Cerrar"><X className="size-3.5" /></button>
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
