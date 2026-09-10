"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkle, Gift, ArrowRight, Flower, Heart, Star } from "@phosphor-icons/react";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProWelcome({ nombre = "Princesa" }: { nombre?: string }) {
  const [open, setOpen] = useState(true);
  const flores = useMemo(() => ["🌸", "🌷", "🌺", "🌼", "💐", "🌹", "🌸", "🌷", "🌺", "🌼", "💮", "🌹"], []);

  async function cerrar() {
    setOpen(false);
    try { await fetch("/api/planes/oferta-vista", { method: "POST" }); } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) void cerrar(); }}>
      <div className="overflow-hidden rounded-2xl">
        <div className="relative -mx-6 -mt-6 mb-6 min-h-[255px] overflow-hidden bg-gradient-to-br from-fuchsia-600 via-pink-500 to-violet-700 px-6 pb-8 pt-7 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.28),transparent_22%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,.2),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,.18),transparent_35%)]" />
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {flores.map((flor, index) => (
              <span key={`${flor}-${index}`} className="absolute animate-bounce text-2xl drop-shadow-sm" style={{ left: `${5 + index * 8}%`, top: `${18 + (index % 4) * 17}%`, animationDelay: `${index * 120}ms`, animationDuration: `${2 + (index % 3) * 0.6}s` }}>{flor}</span>
            ))}
          </div>
          <Sparkle className="absolute right-8 top-6 size-9 animate-pulse opacity-80" weight="fill" />
          <Star className="absolute left-8 top-10 size-5 animate-pulse opacity-70" weight="fill" />
          <Heart className="absolute right-16 bottom-9 size-6 animate-bounce opacity-75" weight="fill" />
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 flex size-20 animate-pulse items-center justify-center rounded-full bg-white/20 shadow-2xl ring-4 ring-white/20 backdrop-blur-sm"><Gift className="size-11" weight="fill" /></div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-white/80">Un regalo solo para ti</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">¡Hola, {nombre}! 👑</h2>
            <p className="mt-2 max-w-md text-sm font-medium text-white/90">Tenemos un obsequio especial para toda una princesa ✨</p>
          </div>
        </div>

        <DialogHeader className="mb-5 text-center sm:text-center">
          <DialogTitle className="text-xl">🌷 {nombre}, esto es para ti 🌷</DialogTitle>
          <DialogDescription className="mt-2 leading-6">Por ser toda una princesa, tienes un <strong>regalo especial de bienvenida</strong>: una licencia de MyMoney PRO de por vida para que disfrutes todo sin límites.</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 via-fuchsia-50 to-violet-50 p-5 dark:border-pink-900/50 dark:from-pink-950/30 dark:via-fuchsia-950/20 dark:to-violet-950/30">
          <div className="absolute -right-4 -top-5 text-5xl opacity-30">💐</div>
          <div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500"><Flower className="size-6" weight="fill" /></div><div><p className="font-bold">Tu regalo de bienvenida 🎁</p><p className="mt-1 text-sm text-muted-foreground">MyMoney PRO · acceso de por vida · sin fecha de vencimiento</p></div></div>
        </div>

        <DialogFooter className="mt-6 sm:justify-center">
          <button type="button" onClick={() => void cerrar()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">Empezar a usar MyMoney</button>
          <Link href="/tracking/planes" onClick={() => void cerrar()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Ver planes <ArrowRight weight="bold" className="size-4" /></Link>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
