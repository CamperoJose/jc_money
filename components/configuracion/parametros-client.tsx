"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  Check,
  X,
  Warning,
  Tag,
  TrendUp,
  Bank,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind } from "@/lib/types";

type Tab = "gasto" | "ingreso" | "inversion";

const TABS: { id: Tab; label: string; icon: typeof Tag }[] = [
  { id: "gasto", label: "Categorías de gasto", icon: Tag },
  { id: "ingreso", label: "Categorías de ingreso", icon: TrendUp },
  { id: "inversion", label: "Categorías de inversión", icon: Bank },
];

export function ParametrosClient({ categorias }: { categorias: Category[] }) {
  const [tab, setTab] = useState<Tab>("gasto");

  const porKind = (k: CategoryKind) =>
    categorias.filter((c) => c.kind === k).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parámetros</h1>
        <p className="text-sm text-muted-foreground">
          Administra los catálogos de categorías que usan tus movimientos e inversiones.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map((t) => {
          const activo = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activo
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <t.icon weight={activo ? "fill" : "duotone"} className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "gasto" && (
        <Catalogo
          key="gasto"
          items={porKind("gasto")}
          endpoint="/api/parametros/categorias"
          extraCreate={{ kind: "gasto" }}
          singular="categoría de gasto"
          placeholder="Nueva categoría de gasto…"
        />
      )}
      {tab === "ingreso" && (
        <Catalogo
          key="ingreso"
          items={porKind("ingreso")}
          endpoint="/api/parametros/categorias"
          extraCreate={{ kind: "ingreso" }}
          singular="categoría de ingreso"
          placeholder="Nueva categoría de ingreso…"
        />
      )}
      {tab === "inversion" && (
        <Catalogo
          key="inversion"
          items={porKind("inversion")}
          endpoint="/api/parametros/categorias"
          extraCreate={{ kind: "inversion" }}
          singular="categoría de inversión"
          placeholder="Nueva categoría de inversión…"
        />
      )}
    </div>
  );
}

interface ItemBase {
  id: string;
  name: string;
  active: boolean;
}

function Catalogo({
  items,
  endpoint,
  extraCreate,
  singular,
  placeholder,
}: {
  items: ItemBase[];
  endpoint: string;
  extraCreate?: Record<string, unknown>;
  singular: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const ordenados = useMemo(
    () => [...items].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [items]
  );

  async function llamar(url: string, method: string, body?: unknown) {
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function agregar() {
    if (!nuevo.trim()) return;
    const ok = await llamar(endpoint, "POST", { name: nuevo.trim(), ...extraCreate });
    if (ok) setNuevo("");
  }

  async function guardarEdicion(id: string) {
    if (!editNombre.trim()) return;
    const ok = await llamar(`${endpoint}/${id}`, "PATCH", { name: editNombre.trim() });
    if (ok) setEditId(null);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Agregar */}
        <div className="flex gap-2">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            disabled={ocupado}
          />
          <Button onClick={agregar} disabled={ocupado || !nuevo.trim()} className="shrink-0">
            <Plus weight="bold" className="size-4" />
            Agregar
          </Button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <Warning weight="fill" className="size-4" />
            {error}
          </p>
        )}

        {/* Lista */}
        {ordenados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay {singular}s todavía. Agrega la primera arriba.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {ordenados.map((it) => (
              <li key={it.id} className="flex items-center gap-2 px-3 py-2.5">
                {editId === it.id ? (
                  <>
                    <Input
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") guardarEdicion(it.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      autoFocus
                      className="h-8 flex-1"
                      disabled={ocupado}
                    />
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => guardarEdicion(it.id)} aria-label="Guardar">
                      <Check weight="bold" className="size-4 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)} aria-label="Cancelar">
                      <X weight="bold" className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={cn("flex-1 truncate text-sm", !it.active && "text-muted-foreground line-through")}>
                      {it.name}
                    </span>
                    <button
                      onClick={() => llamar(`${endpoint}/${it.id}`, "PATCH", { active: !it.active })}
                      disabled={ocupado}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                        it.active
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      )}
                      title={it.active ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
                    >
                      {it.active ? "Activo" : "Inactivo"}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setEditId(it.id);
                        setEditNombre(it.name);
                      }}
                      aria-label="Editar"
                    >
                      <PencilSimple className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`¿Borrar “${it.name}”?`)) llamar(`${endpoint}/${it.id}`, "DELETE");
                      }}
                      aria-label="Borrar"
                    >
                      <Trash className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Desactivar oculta el {singular} en los formularios nuevos sin borrar el historial. Borrar lo
          elimina; los movimientos que lo usaban quedan sin ese valor.
        </p>
      </CardContent>
    </Card>
  );
}
