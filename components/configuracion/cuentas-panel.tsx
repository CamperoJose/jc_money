"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PencilSimple, Trash, Check, X, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useAvisos } from "@/components/ui/toast";
import type { Account, AccountType, Currency } from "@/lib/types";

const TIPOS: { value: AccountType; label: string }[] = [
  { value: "banco", label: "Banco" }, { value: "efectivo", label: "Efectivo" },
  { value: "stablecoin", label: "Stablecoin" }, { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "dpf", label: "DPF" }, { value: "por_cobrar", label: "Por cobrar" }, { value: "otro", label: "Otro" },
];
const MONEDAS: Currency[] = ["BOB", "USD", "USDT"];

export function CuentasPanel({ cuentas }: { cuentas: Account[] }) {
  const router = useRouter(); const avisos = useAvisos();
  const [form, setForm] = useState({ name: "", type: "banco" as AccountType, currency: "BOB" as Currency, liability: false });
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [error, setError] = useState<string | null>(null);
  async function llamar(method: string, body?: unknown, id?: string) {
    setError(null); setOcupado(true);
    try { const url = id ? `/api/parametros/cuentas?id=${id}` : "/api/parametros/cuentas";
      const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
      router.refresh(); avisos.exito("Cuentas actualizadas"); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); return false; } finally { setOcupado(false); }
  }
  async function agregar() { if (!form.name.trim()) return; const ok = await llamar("POST", { name: form.name, type: form.type, currency: form.currency, is_liability: form.liability }); if (ok) setForm({ name: "", type: "banco", currency: "BOB", liability: false }); }
  return <Card><CardContent className="space-y-4 p-4 sm:p-6">
    <div><h2 className="text-lg font-semibold">Cuentas y billeteras</h2><p className="text-sm text-muted-foreground">Registra únicamente las cuentas que utilizas. No se crean bancos automáticamente.</p></div>
    <div className="grid gap-2 sm:grid-cols-[1fr_180px_100px_auto_auto]"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Banco Unión" disabled={ocupado} onKeyDown={e => e.key === "Enter" && agregar()} /><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AccountType })} disabled={ocupado}>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</Select><Select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as Currency })} disabled={ocupado}>{MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}</Select><label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={form.liability} onChange={e => setForm({ ...form, liability: e.target.checked })} /> Pasivo</label><Button onClick={agregar} disabled={ocupado || !form.name.trim()}><Plus weight="bold" className="size-4" />Agregar</Button></div>
    {error && <p className="flex items-center gap-1.5 text-sm text-destructive"><Warning weight="fill" className="size-4" />{error}</p>}
    {cuentas.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no tienes cuentas. Registra la primera arriba para poder crear tu primer patrimonio.</div> : <ul className="divide-y rounded-lg border">{cuentas.map(c => <Fila key={c.id} cuenta={c} editando={editando === c.id} ocupado={ocupado} setEditando={setEditando} guardar={async (b) => { await llamar("PATCH", { id: c.id, ...b }); setEditando(null); }} toggle={() => llamar("PATCH", { id: c.id, active: !c.active })} borrar={() => { if (confirm(`¿Borrar “${c.name}”?`)) llamar("DELETE", undefined, c.id); }} />)}</ul>}
    <p className="text-xs text-muted-foreground">Desactivar conserva el historial y oculta la cuenta de formularios nuevos. Si tiene historial, la base de datos impedirá borrarla.</p>
  </CardContent></Card>;
}

function Fila({ cuenta, editando, ocupado, setEditando, guardar, toggle, borrar }: { cuenta: Account; editando: boolean; ocupado: boolean; setEditando: (v: string | null) => void; guardar: (b: Record<string, unknown>) => Promise<void>; toggle: () => void; borrar: () => void }) {
  const [name, setName] = useState(cuenta.name); const [type, setType] = useState<AccountType>(cuenta.type); const [currency, setCurrency] = useState<Currency>(cuenta.currency); const [liability, setLiability] = useState(cuenta.is_liability);
  if (editando) return <li className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_180px_100px_auto_auto]"><Input value={name} onChange={e => setName(e.target.value)} disabled={ocupado} autoFocus /><Select value={type} onChange={e => setType(e.target.value as AccountType)} disabled={ocupado}>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</Select><Select value={currency} onChange={e => setCurrency(e.target.value as Currency)} disabled={ocupado}>{MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}</Select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={liability} onChange={e => setLiability(e.target.checked)} /> Pasivo</label><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => guardar({ name, type, currency, is_liability: liability })}><Check className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => setEditando(null)}><X className="size-4" /></Button></div></li>;
  return <li className="flex flex-wrap items-center gap-2 px-3 py-2.5"><span className={`min-w-32 flex-1 truncate text-sm ${!cuenta.active ? "text-muted-foreground line-through" : ""}`}>{cuenta.name}</span><span className="rounded bg-muted px-2 py-0.5 text-xs">{TIPOS.find(t => t.value === cuenta.type)?.label}</span><span className="rounded bg-muted px-2 py-0.5 text-xs">{cuenta.currency}</span>{cuenta.is_liability && <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Pasivo</span>}<button onClick={toggle} disabled={ocupado} className="rounded-full bg-muted px-2 py-0.5 text-xs">{cuenta.active ? "Activa" : "Inactiva"}</button><Button size="icon" variant="ghost" className="size-8" onClick={() => setEditando(cuenta.id)} disabled={ocupado}><PencilSimple className="size-4" /></Button><Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={borrar} disabled={ocupado}><Trash className="size-4" /></Button></li>;
}
