"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Diálogo modal ligero (sin dependencias extra). Controlado por `open`.
 * Cierra con Escape, click en el overlay o el botón X.
 */
export function Dialog({
  open,
  onOpenChange,
  onEnviar,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Acción principal del diálogo. Si se pasa, Enter en cualquier campo la
   * dispara (no en un textarea, donde Enter es salto de línea). Los formularios
   * de la app no son `<form>`, así que sin esto Enter no hacía nada.
   */
  onEnviar?: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const panel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    // Devolver el foco al elemento que abrió el diálogo cuando se cierre; si no,
    // el foco vuelve al principio de la página y hay que retabular todo.
    const previo = document.activeElement as HTMLElement | null;

    const enfocables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key === "Enter" && onEnviar) {
        const el = document.activeElement as HTMLElement | null;
        const etiqueta = el?.tagName;
        const esCampo = etiqueta === "INPUT" || etiqueta === "SELECT";
        if (esCampo && panel.current?.contains(el)) {
          e.preventDefault();
          onEnviar();
          return;
        }
      }
      // Trampa de foco: sin esto, tabular saca del diálogo hacia la página de
      // atrás, que está oculta para el usuario pero no para el teclado.
      if (e.key !== "Tab") return;
      const lista = enfocables();
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || !panel.current?.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Enfoca el primer campo al abrir: antes había que tocarlo a mano en cada
    // formulario (solo un `autoFocus` en toda la app).
    const t = window.setTimeout(() => {
      const lista = enfocables();
      // Salta el botón de cerrar (siempre el último del DOM) si hay un campo.
      const campo = lista.find((el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
      (campo ?? lista[0] ?? panel.current)?.focus();
    }, 30);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previo?.focus?.();
    };
  }, [open, onOpenChange, onEnviar]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="vidrio-velo fixed inset-0 animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="vidrio relative z-10 my-8 w-full max-w-lg rounded-xl border border-border p-6 shadow-xl animate-in fade-in zoom-in-95"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Cerrar"
        >
          <X weight="bold" className="size-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1 pr-8", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
