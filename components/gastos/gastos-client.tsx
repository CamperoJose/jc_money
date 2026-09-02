"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilSimple,
  Trash,
  Warning,
  MagnifyingGlass,
  TrendDown,
  TrendUp,
  Receipt,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GastoForm } from "@/components/gastos/gasto-form";
import { formatBob, formatDateTime, formatNumber } from "@/lib/format";
import type { Account, Category, Participant, TransactionUI } from "@/lib/types";

export function GastosClient({
  transacciones,
  cuentas,
  categorias,
  participantes,
}: {
  transacciones: TransactionUI[];
  cuentas: Account[];
  categorias: Category[];
  participantes: Participant[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TransactionUI | null>(null);
  const [borrar, setBorrar] = useState<TransactionUI | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "gasto" | "ingreso">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return transacciones.filter((t) => {
      if (filtroTipo !== "todos" && t.type !== filtroTipo) return false;
      if (filtroCategoria && t.category_id !== filtroCategoria) return false;
      if (q) {
        const hay = [t.description, t.category?.name, t.account?.name, t.participant?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transacciones, busqueda, filtroTipo, filtroCategoria]);

  const totalFiltrado = useMemo(
    () =>
      filtradas.reduce((acc, t) => acc + (t.type === "gasto" ? -t.amount_bob : t.amount_bob), 0),
    [filtradas]
  );

  const categoriasUsadas = useMemo(() => {
    const ids = new Set(transacciones.map((t) => t.category_id).filter(Boolean));
    return categorias.filter((c) => ids.has(c.id));
  }, [transacciones, categorias]);

  function nuevo() {
    setEditando(null);
    setFormOpen(true);
  }
  function editar(t: TransactionUI) {
    setEditando(t);
    setFormOpen(true);
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setBorrando(true);
    setErrorBorrar(null);
    try {
      const res = await fetch(`/api/gastos/transacciones/${borrar.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setBorrar(null);
      router.refresh();
    } catch (e) {
      setErrorBorrar(e instanceof Error ? e.message : "Error al borrar.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            {transacciones.length} {transacciones.length === 1 ? "movimiento" : "movimientos"} registrados.
          </p>
        </div>
        <Button onClick={nuevo}>
          <Plus weight="bold" className="size-4" />
          Nuevo movimiento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por detalle, categoría, cuenta…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select
          className="sm:w-40"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
        >
          <option value="todos">Todos</option>
          <option value="gasto">Gastos</option>
          <option value="ingreso">Ingresos</option>
        </Select>
        <Select
          className="sm:w-52"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categoriasUsadas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Receipt weight="duotone" className="size-8 opacity-60" />
            {transacciones.length === 0
              ? "No hay movimientos aún. Registra el primero con “Nuevo movimiento”."
              : "Ningún movimiento coincide con los filtros."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumen del filtro */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"} · neto
            </span>
            <span
              className={`font-bold tabular-nums ${totalFiltrado < 0 ? "text-destructive" : "text-primary"}`}
            >
              {formatBob(totalFiltrado)}
            </span>
          </div>

          {/* Tabla (desktop) */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="relative w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Fecha y hora</th>
                    <th className="px-3 py-2.5 font-medium">Detalle</th>
                    <th className="px-3 py-2.5 font-medium">Categoría</th>
                    <th className="px-3 py-2.5 font-medium">Cuenta</th>
                    <th className="px-3 py-2.5 font-medium">Participante</th>
                    <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                    <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((t) => (
                    <tr key={t.id} className="border-b transition-colors hover:bg-muted/40">
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {formatDateTime(t.occurred_at)}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <TipoIcon tipo={t.type} />
                          <span className="truncate" title={t.description ?? ""}>
                            {t.description || <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {t.category ? (
                          <Badge variant="secondary">{t.category.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.account?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{t.participant?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <MontoCelda t={t} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => editar(t)} aria-label="Editar">
                            <PencilSimple className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setErrorBorrar(null);
                              setBorrar(t);
                            }}
                            aria-label="Borrar"
                          >
                            <Trash className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tarjetas (móvil) */}
          <div className="grid gap-2 lg:hidden">
            {filtradas.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <TipoIcon tipo={t.type} />
                      <span className="truncate text-sm font-medium">
                        {t.description || (t.category?.name ?? "Movimiento")}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(t.occurred_at)}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.category && <Badge variant="secondary">{t.category.name}</Badge>}
                      {t.account && <Badge variant="outline">{t.account.name}</Badge>}
                      {t.participant && <Badge variant="outline">{t.participant.name}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <MontoCelda t={t} />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => editar(t)} aria-label="Editar">
                        <PencilSimple className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          setErrorBorrar(null);
                          setBorrar(t);
                        }}
                        aria-label="Borrar"
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <GastoForm
          key={editando?.id ?? "nuevo"}
          cuentas={cuentas}
          categorias={categorias}
          participantes={participantes}
          registro={editando}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}

      <Dialog open={!!borrar} onOpenChange={(v) => !v && setBorrar(null)}>
        <DialogHeader>
          <DialogTitle>Borrar movimiento</DialogTitle>
          <DialogDescription>
            Se eliminará este {borrar?.type === "ingreso" ? "ingreso" : "gasto"}
            {borrar?.description ? ` (“${borrar.description}”)` : ""}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {errorBorrar && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <Warning weight="fill" className="size-4" />
            {errorBorrar}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setBorrar(null)} disabled={borrando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmarBorrar} disabled={borrando}>
            <Trash weight="bold" className="size-4" />
            {borrando ? "Borrando…" : "Borrar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function TipoIcon({ tipo }: { tipo: "gasto" | "ingreso" }) {
  return tipo === "gasto" ? (
    <TrendDown weight="bold" className="size-4 shrink-0 text-destructive" />
  ) : (
    <TrendUp weight="bold" className="size-4 shrink-0 text-primary" />
  );
}

function MontoCelda({ t }: { t: TransactionUI }) {
  const signo = t.type === "gasto" ? "−" : "+";
  return (
    <span className="text-right">
      <span
        className={`block font-semibold tabular-nums ${t.type === "gasto" ? "text-destructive" : "text-primary"}`}
      >
        {signo} {formatBob(t.amount_bob)}
      </span>
      {t.currency !== "BOB" && (
        <span className="block text-xs text-muted-foreground tabular-nums">
          {formatNumber(t.amount, 2)} {t.currency}
        </span>
      )}
    </span>
  );
}
