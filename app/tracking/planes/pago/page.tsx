"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LockKey, ShieldCheck, CreditCard, PaypalLogo, CheckCircle, CaretDown } from "@phosphor-icons/react";

export default function PagoPage() {
  return <Suspense fallback={<div className="mx-auto max-w-5xl py-12 text-center text-sm text-muted-foreground">Cargando checkout…</div>}><Checkout /></Suspense>;
}

function Checkout() {
  const params = useSearchParams();
  const plan = params.get("plan") || "PRO Anual";
  const precio = params.get("precio") || "$999";
  const periodo = params.get("periodo") || "/ año";

  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-6">
      <Link href="/tracking/planes" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a los planes</Link>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <div className="border-b border-border bg-[#f5f7fa] px-5 py-4 dark:bg-muted/30 sm:px-8"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2 font-black tracking-tight text-[#003087] dark:text-blue-300"><PaypalLogo className="size-8" weight="fill" /> PayPal</div><div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><LockKey className="size-4" weight="fill" /> Pago protegido</div></div></div>
        <div className="grid lg:grid-cols-[1fr_380px]">
          <main className="p-6 sm:p-9">
            <div className="mb-7"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completa tu compra</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Paga con PayPal</h1><p className="mt-2 text-sm text-muted-foreground">Estás a un paso de activar tu experiencia MyMoney PRO.</p></div>
            <div className="mb-6 rounded-2xl border border-border bg-background p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-bold">{plan}</p><p className="mt-1 text-xs text-muted-foreground">MyMoney PRO {periodo}</p></div><p className="text-xl font-black">{precio}</p></div></div>
            <div className="space-y-4">
              <div><label className="mb-1.5 block text-sm font-semibold">Correo electrónico</label><input type="email" placeholder="tu@email.com" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/20 placeholder:text-muted-foreground focus:ring-4" /></div>
              <div><label className="mb-1.5 block text-sm font-semibold">Método de pago</label><button type="button" className="flex h-12 w-full items-center justify-between rounded-lg border-2 border-[#0070ba] bg-background px-4 text-sm font-semibold"><span className="flex items-center gap-2"><PaypalLogo className="size-5 text-[#0070ba]" weight="fill" /> PayPal</span><CheckCircle className="size-5 text-[#0070ba]" weight="fill" /></button></div>
              <div className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3"><CreditCard className="size-5 text-muted-foreground" /><div><p className="text-sm font-semibold">Continuar con PayPal</p><p className="text-xs text-muted-foreground">Serás dirigido al flujo de autenticación de PayPal.</p></div><CaretDown className="ml-auto size-4 text-muted-foreground" /></div></div>
              <button type="button" className="h-12 w-full rounded-xl bg-[#0070ba] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005ea6] hover:shadow-md">Continuar con PayPal</button>
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><ShieldCheck className="mt-0.5 size-4 shrink-0" weight="fill" /><span><strong>Modo demostración:</strong> esta pantalla es un checkout visual no funcional. No se procesan pagos ni se solicitan credenciales reales.</span></div>
          </main>
          <aside className="border-t border-border bg-muted/20 p-6 sm:p-9 lg:border-l lg:border-t-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumen</p><h2 className="mt-2 text-lg font-bold">Tu pedido</h2>
            <div className="mt-6 space-y-4 border-b border-border pb-5"><div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Plan</span><span className="text-right font-semibold">{plan}</span></div><div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Periodo</span><span className="font-semibold">{periodo.replace("/", "")}</span></div></div>
            <div className="mt-5 flex items-end justify-between"><span className="font-bold">Total</span><span className="text-3xl font-black">{precio}</span></div>
            <div className="mt-6 space-y-2 text-xs text-muted-foreground"><div className="flex items-center gap-2"><CheckCircle className="size-4 text-primary" weight="fill" /> Acceso a todas las funciones PRO</div><div className="flex items-center gap-2"><CheckCircle className="size-4 text-primary" weight="fill" /> Pago procesado de forma segura</div></div>
          </aside>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">PayPal · MyMoney · Entorno de demostración</p>
    </div>
  );
}
