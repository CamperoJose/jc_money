"use client";

import {
  TrendUp,
  TrendDown,
  Warning,
  Info,
  CheckCircle,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface HallazgoUI {
  id: string;
  titulo: string;
  detalle: string;
  tono: "bueno" | "malo" | "neutro" | "aviso";
}

// El color va por tono semántico, no por gusto: verde solo cuando es una buena
// noticia, rojo solo cuando exige actuar. Todos los pares llegan a 4,5:1 sobre
// el fondo de la tarjeta en ambos temas.
const estilo = {
  bueno: {
    icono: CheckCircle,
    marco: "border-emerald-500/30 bg-emerald-500/[0.06]",
    acento: "text-emerald-700 dark:text-emerald-400",
  },
  malo: {
    icono: TrendDown,
    marco: "border-destructive/30 bg-destructive/[0.06]",
    acento: "text-destructive",
  },
  aviso: {
    icono: Warning,
    marco: "border-amber-500/30 bg-amber-500/[0.06]",
    acento: "text-amber-700 dark:text-amber-400",
  },
  neutro: {
    icono: Info,
    marco: "border-border bg-muted/40",
    acento: "text-muted-foreground",
  },
} as const;

export function ListaHallazgos({
  hallazgos,
  titulo = "Qué dicen tus datos",
  vacio = "Todavía no hay suficientes datos para detectar patrones.",
}: {
  hallazgos: HallazgoUI[];
  titulo?: string;
  vacio?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <TrendUp weight="duotone" className="size-5 text-primary" />
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {hallazgos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {hallazgos.map((h) => {
              const e = estilo[h.tono];
              const Icono = e.icono;
              return (
                <li
                  key={h.id}
                  className={cn("flex gap-3 rounded-lg border p-3.5", e.marco)}
                >
                  <Icono weight="duotone" className={cn("mt-0.5 size-5 shrink-0", e.acento)} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug">{h.titulo}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.detalle}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
