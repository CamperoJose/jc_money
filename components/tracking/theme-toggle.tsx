"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Desktop } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Tema = "light" | "dark" | "system";
const STORAGE = "mymoney.theme";

function aplicar(tema: Tema) {
  const oscuro =
    tema === "dark" ||
    (tema === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", oscuro);
}

const OPCIONES: { id: Tema; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "system", label: "Sistema", icon: Desktop },
  { id: "dark", label: "Oscuro", icon: Moon },
];

/** Selector de tema (claro/oscuro/sistema), persistido y sin flash. */
export function ThemeToggle({ mini }: { mini?: boolean }) {
  const [tema, setTema] = useState<Tema>("system");

  useEffect(() => {
    let inicial: Tema = "system";
    try {
      const g = localStorage.getItem(STORAGE) as Tema | null;
      if (g === "light" || g === "dark" || g === "system") inicial = g;
    } catch {}
    setTema(inicial);
  }, []);

  // Reacciona al cambio del SO cuando está en "system".
  useEffect(() => {
    if (tema !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => aplicar("system");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [tema]);

  function elegir(t: Tema) {
    setTema(t);
    try {
      localStorage.setItem(STORAGE, t);
    } catch {}
    aplicar(t);
  }

  if (mini) {
    // Colapsado: un solo botón que cicla claro → oscuro → sistema.
    const orden: Tema[] = ["light", "dark", "system"];
    const actual = OPCIONES.find((o) => o.id === tema) ?? OPCIONES[1];
    const Icono = actual.icon;
    return (
      <button
        type="button"
        onClick={() => elegir(orden[(orden.indexOf(tema) + 1) % orden.length])}
        title={`Tema: ${actual.label} (clic para cambiar)`}
        className="flex w-full items-center justify-center rounded-lg py-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Icono weight="duotone" className="size-[18px]" />
      </button>
    );
  }

  return (
    <div className="mb-1 flex gap-1 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 p-1">
      {OPCIONES.map((o) => {
        const activo = tema === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => elegir(o.id)}
            title={o.label}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
              activo
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <o.icon weight={activo ? "fill" : "duotone"} className="size-4" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
