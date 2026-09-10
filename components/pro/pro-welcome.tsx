"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Sparkle, Gift, ArrowRight, Ticket } from "@phosphor-icons/react";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ProWelcome() {
  const [open, setOpen] = useState(true);

  async function cerrar() {
    setOpen(false);
    try { await fetch("/api/planes/oferta-vista", { method: "POST" }); } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) void cerrar(); }}>
      <div className="overflow-hidden rounded-lg">
        <div className="relative -mx-6 -mt-6 mb-6 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-violet-700 px-6 pb-7 pt-7 text-primary-foreground">
          <Sparkle className="absolute right-7 top-5 size-7 opacity-40" weight="fill" />
          <Sparkle className="absolute bottom-5 left-8 size-4 opacity-30" weight="fill" />
          <div className="relative flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25"><Crown className="size-8" weight="fill" /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">MyMoney</p><p className="text-2xl font-black tracking-tight">PRO desbloqueado</p></div>
          </div>
        </div>

        <DialogHeader className="mb-5">
          <DialogTitle className="text-xl">🎁 Tienes una oferta especial</DialogTitle>
          <DialogDescription className="mt-2 leading-6">Eres un usuario premium y has accedido a una <strong>licencia de por vida</strong> de MyMoney PRO. Tu acceso premium está listo para disfrutar todas las funciones.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3"><Gift className="mt-0.5 size-5 shrink-0 text-primary" weight="duotone" /><div><p className="font-semibold">Tu regalo de bienvenida</p><p className="mt-1 text-sm text-muted-foreground">Licencia PRO · acceso de por vida · sin fecha de vencimiento</p></div></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-primary/30 bg-background px-4 py-3">
            <div className="flex items-center gap-2"><Ticket className="size-5 text-primary" weight="duotone" /><span className="text-xs font-semibold text-muted-foreground">Cupón de bienvenida</span></div>
            <code className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-black tracking-wider text-primary">PRO-LIFE</code>
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => void cerrar()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">Empezar a usar MyMoney</button>
          <Link href="/tracking/planes" onClick={() => void cerrar()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Ver planes <ArrowRight weight="bold" className="size-4" /></Link>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
