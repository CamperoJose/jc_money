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
import { CategoryBar } from "@/components/tremor/category-bar";
import { ProgressCircle } from "@/components/tremor/progress-circle";
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
import {
  TableRoot,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableFoot,
} from "@/components/tremor/table";
import { GastoForm } from "@/components/gastos/gasto-form";
import { formatBob, formatDateTime, formatNumber } from "@/lib/format";
import { fechaBoliviaHoy } from "@/lib/datetime";
import type { Account, Category, TransactionUI, TxnSource } from "@/lib/types";

/** Día de la semana de una fecha YYYY-MM-DD (es-BO). */
function diaSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-BO", { weekday: "long", timeZone: "UTC" }).format(d);
}

/** "hoy" / "ayer" / "hace N d" respecto a hoy en Bolivia. */
function antiguedad(fecha: string): string {
  const a = Date.parse(`${fecha}T00:00:00Z`);
  const b = Date.parse(`${fechaBoliviaHoy()}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  const d = Math.round((b - a) / 86_400_000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} d`;
}

/** Cómo se registró el movimiento (manual, por voz o por API). */
function OrigenBadge({ source }: { source: TxnSource }) {
  if (source === "voz") return <Badge variant="default">🎙️ Voz</Badge>;
  if (source === "api") return <Badge variant="neutral">API</Badge>;
  return <Badge variant="neutral">Manual</Badge>;
}

export function GastosClient({
  transacciones,
  cuentas,
  categorias,
}: {
  transacciones: TransactionUI[];
  cuentas: Account[];
  categorias: Category[];
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
        const hay = [t.description, t.category?.name, t.account?.name]
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

  // Totales y escala para el pie de tabla y las barras de peso relativo.
  const { totalGastos, totalIngresos, neto, maxBob } = useMemo(() => {
    let g = 0;
    let i = 0;
    let max = 0;
    for (const t of filtradas) {
      if (t.type === "gasto") g += t.amount_bob;
      else i += t.amount_bob;
      if (t.amount_bob > max) max = t.amount_bob;
    }
    return { totalGastos: g, totalIngresos: i, neto: i - g, maxBob: max };
  }, [filtradas]);

  // Total por categoría dentro del filtro, para mostrar cuánto pesa cada
  // categoría en la fila (idioma de la plantilla: dato + contexto debajo).
  const totalPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of filtradas) {
      if (!t.category_id) continue;
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + t.amount_bob);
    }
    return m;
  }, [filtradas]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Movimientos</h1>
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

          {/* Tabla (desktop) — estilo Tremor, con más detalle por fila */}
          <Card className="hidden overflow-hidden lg:block">
            <TableRoot>
              <Table>
                <TableHead>
                  <TableRow className="hover:bg-transparent">
                    <TableHeaderCell>Fecha y hora</TableHeaderCell>
                    <TableHeaderCell>Detalle</TableHeaderCell>
                    <TableHeaderCell>Categoría</TableHeaderCell>
                    <TableHeaderCell>Cuenta</TableHeaderCell>
                    <TableHeaderCell>Origen</TableHeaderCell>
                    <TableHeaderCell className="min-w-[150px]">Peso en el filtro</TableHeaderCell>
                    <TableHeaderCell className="min-w-[150px] text-right">Monto</TableHeaderCell>
                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtradas.map((t) => {
                    const peso = maxBob > 0 ? t.amount_bob / maxBob : 0;
                    return (
                      <TableRow key={t.id}>
                        {/* Fecha + día de la semana + antigüedad */}
                        <TableCell className="whitespace-nowrap">
                          <div className="text-foreground">{formatDateTime(t.occurred_at)}</div>
                          <div className="text-xs capitalize text-muted-foreground">
                            {diaSemana(t.txn_date)} · {antiguedad(t.txn_date)}
                          </div>
                        </TableCell>

                        {/* Detalle: descripción arriba, tipo y etiquetas debajo */}
                        <TableCell className="max-w-[240px]">
                          <div className="flex items-center gap-2">
                            <TipoIcon tipo={t.type} />
                            <span
                              className="truncate font-medium text-foreground"
                              title={t.description ?? ""}
                            >
                              {t.description || <span className="font-normal text-muted-foreground">Sin descripción</span>}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">
                            {t.type === "ingreso" ? "Ingreso" : "Gasto"}
                            {t.tags && t.tags.length > 0 ? ` · ${t.tags.join(", ")}` : ""}
                          </div>
                        </TableCell>

                        {/* Categoría + cuánto pesa esa categoría en el filtro */}
                        <TableCell className="whitespace-nowrap">
                          {t.category ? (
                            <>
                              <Badge variant="neutral" className="gap-1.5 font-normal">
                                <span
                                  className={`size-2 shrink-0 rounded-sm ${t.type === "ingreso" ? "bg-emerald-500" : "bg-blue-500"}`}
                                  aria-hidden
                                />
                                {t.category.name}
                              </Badge>
                              <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                {formatBob(totalPorCategoria.get(t.category_id ?? "") ?? 0)} en el filtro
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Cuenta + tipo y moneda */}
                        <TableCell className="whitespace-nowrap">
                          <div className="text-foreground">{t.account?.name ?? "—"}</div>
                          {t.account && (
                            <div className="text-xs capitalize text-muted-foreground">
                              {t.account.type.replace("_", " ")} · {t.account.currency}
                            </div>
                          )}
                        </TableCell>

                        {/* Origen del registro (manual / voz / api) */}
                        <TableCell>
                          <OrigenBadge source={t.source} />
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {t.source === "voz" ? "dictado" : t.source === "api" ? "atajo iOS" : "en la app"}
                          </div>
                        </TableCell>

                        {/* Peso relativo: anillo con el % y el contexto debajo */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <ProgressCircle
                              value={peso * 100}
                              radius={16}
                              strokeWidth={3.5}
                              variant={t.type === "ingreso" ? "success" : peso >= 0.66 ? "error" : peso >= 0.33 ? "warning" : "default"}
                            >
                              <span className="text-[10px] font-semibold tabular-nums">
                                {Math.round(peso * 100)}
                              </span>
                            </ProgressCircle>
                            <div className="min-w-0">
                              <div className="text-foreground">
                                <span className="text-muted-foreground">del mayor </span>
                                <span className="font-medium tabular-nums">{formatBob(maxBob)}</span>
                              </div>
                              <div className="truncate text-xs tabular-nums text-muted-foreground">
                                {t.type === "ingreso"
                                  ? `${totalIngresos > 0 ? Math.round((t.amount_bob / totalIngresos) * 100) : 0}% de los ingresos`
                                  : `${totalGastos > 0 ? Math.round((t.amount_bob / totalGastos) * 100) : 0}% de los gastos`}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Monto en BOB + moneda original y T/C */}
                        <TableCell className="text-right">
                          <MontoCelda t={t} />
                        </TableCell>

                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFoot>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="font-semibold">
                      {filtradas.length} {filtradas.length === 1 ? "movimiento" : "movimientos"}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-muted-foreground">
                      Ingresos {formatBob(totalIngresos)}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-muted-foreground">
                      Mayor {formatBob(maxBob)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <span className="text-destructive">−{formatBob(totalGastos)}</span>
                      <div className={`text-xs font-normal ${neto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        neto {neto >= 0 ? "+" : "−"}{formatBob(Math.abs(neto))}
                      </div>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFoot>
              </Table>
            </TableRoot>
          </Card>

          {/* Tarjetas (móvil): misma información que la tabla de escritorio. */}
          <div className="grid gap-2 lg:hidden">
            {/* Resumen del filtro, equivalente al pie de la tabla. */}
            <Card className="overflow-hidden">
              <CardContent className="p-3">
                <CategoryBar
                  segmentos={[
                    { etiqueta: "Ingresos", valor: totalIngresos, color: "var(--color-chart-1)" },
                    { etiqueta: "Gastos", valor: totalGastos, color: "var(--color-destructive)" },
                  ]}
                  formato="bob"
                />
                <div className="mt-3 flex items-baseline justify-between border-t pt-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Neto · {filtradas.length} mov.
                  </span>
                  <span
                    className={`text-base font-semibold tabular-nums ${neto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                  >
                    {neto >= 0 ? "+" : "−"}
                    {formatBob(Math.abs(neto))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {filtradas.map((t) => {
              const peso = maxBob > 0 ? t.amount_bob / maxBob : 0;
              return (
                <Card key={t.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <TipoIcon tipo={t.type} />
                          <span className="truncate text-sm font-medium">
                            {t.description || (t.category?.name ?? "Movimiento")}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(t.occurred_at)}
                        </div>
                        <div className="text-xs capitalize text-muted-foreground">
                          {diaSemana(t.txn_date)} · {antiguedad(t.txn_date)}
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
                    </div>

                    {/* Peso del movimiento dentro del filtro actual. */}
                    <div className="mt-2 h-1 w-full canal overflow-hidden rounded-full bg-muted">
                      <div
                        className={`relleno-brillo h-full rounded-full ${t.type === "ingreso" ? "bg-emerald-500" : "bg-destructive/70"}`}
                        style={{ width: `${Math.min(100, peso * 100)}%` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {t.category && <Badge variant="secondary">{t.category.name}</Badge>}
                      {t.account && (
                        <Badge variant="outline">
                          {t.account.name} · {t.account.currency}
                        </Badge>
                      )}
                      <OrigenBadge source={t.source} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {formOpen && (
        <GastoForm
          key={editando?.id ?? "nuevo"}
          cuentas={cuentas}
          categorias={categorias}
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
      <span className="block text-xs tabular-nums text-muted-foreground">
        {t.currency !== "BOB"
          ? `${formatNumber(t.amount, 2)} ${t.currency} · T/C ${formatNumber(t.exchange_rate ?? 0, 2)}`
          : t.type === "gasto"
            ? "salida"
            : "entrada"}
      </span>
    </span>
  );
}
