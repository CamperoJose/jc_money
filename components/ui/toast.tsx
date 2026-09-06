"use client";

// Sistema de avisos (toasts) propio, sin dependencias: usa los tokens del tema y
// el sistema de superficies de `globals.css`. Antes la app no confirmaba nada —
// se guardaba un registro, la pantalla se refrescaba y no había señal de si
// había funcionado.
import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Warning, Info, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Tono = "exito" | "error" | "info";

interface Aviso {
  id: number;
  tono: Tono;
  titulo: string;
  detalle?: string;
}

interface AvisosApi {
  /** Aviso de éxito; se cierra solo. */
  exito: (titulo: string, detalle?: string) => void;
  /** Aviso de error; NO se cierra solo, para que no se pierda. */
  error: (titulo: string, detalle?: string) => void;
  info: (titulo: string, detalle?: string) => void;
}

const Contexto = React.createContext<AvisosApi | null>(null);

/** Hook para lanzar avisos desde cualquier componente de cliente. */
export function useAvisos(): AvisosApi {
  const ctx = React.useContext(Contexto);
  if (!ctx) {
    throw new Error("useAvisos debe usarse dentro de <ProveedorAvisos>.");
  }
  return ctx;
}

const DURACION_MS = 4500;

const estilos: Record<Tono, { icono: React.ReactNode; borde: string; barra: string }> = {
  exito: {
    icono: <CheckCircle weight="fill" className="size-5 text-emerald-500" />,
    borde: "border-emerald-500/40",
    barra: "bg-emerald-500",
  },
  error: {
    icono: <Warning weight="fill" className="size-5 text-destructive" />,
    borde: "border-destructive/40",
    barra: "bg-destructive",
  },
  info: {
    icono: <Info weight="fill" className="size-5 text-primary" />,
    borde: "border-primary/40",
    barra: "bg-primary",
  },
};

export function ProveedorAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = React.useState<Aviso[]>([]);
  const [montado, setMontado] = React.useState(false);
  const siguienteId = React.useRef(0);

  React.useEffect(() => setMontado(true), []);

  const cerrar = React.useCallback((id: number) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const agregar = React.useCallback(
    (tono: Tono, titulo: string, detalle?: string) => {
      const id = siguienteId.current++;
      setAvisos((prev) => [...prev.slice(-2), { id, tono, titulo, detalle }]);
      // Los errores se quedan hasta que el usuario los cierre: un fallo al
      // guardar dinero no puede desaparecer solo antes de que lo lea.
      if (tono !== "error") {
        window.setTimeout(() => cerrar(id), DURACION_MS);
      }
    },
    [cerrar]
  );

  const api = React.useMemo<AvisosApi>(
    () => ({
      exito: (t, d) => agregar("exito", t, d),
      error: (t, d) => agregar("error", t, d),
      info: (t, d) => agregar("info", t, d),
    }),
    [agregar]
  );

  return (
    <Contexto.Provider value={api}>
      {children}
      {montado &&
        createPortal(
          <div
            // `aria-live="polite"` hace que un lector de pantalla anuncie el
            // aviso sin interrumpir lo que el usuario esté haciendo.
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:items-end"
          >
            {avisos.map((a) => {
              const e = estilos[a.tono];
              return (
                <div
                  key={a.id}
                  role={a.tono === "error" ? "alert" : "status"}
                  className={cn(
                    "vidrio pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border px-4 py-3 shadow-lg",
                    "animate-in fade-in slide-in-from-bottom-2",
                    e.borde
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">{e.icono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                      {a.detalle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.detalle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => cerrar(a.id)}
                      aria-label="Cerrar aviso"
                      className="toque-comodo -mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X weight="bold" className="size-4" />
                    </button>
                  </div>
                  {/* Barra de tiempo restante; en los errores no aparece porque
                      no se cierran solos. */}
                  {a.tono !== "error" && (
                    <span
                      className={cn("absolute bottom-0 left-0 h-0.5 animate-[encoger_4.5s_linear_forwards]", e.barra)}
                    />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </Contexto.Provider>
  );
}
