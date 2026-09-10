import Link from "next/link";
import { Check, Crown, Sparkle, Lightning, Infinity } from "@phosphor-icons/react/dist/ssr";

const PLANES = [
  {
    nombre: "PRO Mensual",
    precio: "$99",
    periodo: "/ mes",
    icono: Lightning,
    destacado: false,
    texto: "Todo lo esencial para llevar tus finanzas al siguiente nivel.",
  },
  {
    nombre: "PRO Anual",
    precio: "$999",
    periodo: "/ año",
    icono: Sparkle,
    destacado: true,
    texto: "Un año completo de MyMoney PRO para quienes quieren constancia.",
  },
  {
    nombre: "PRO Vitalicio",
    precio: "$4999",
    periodo: " para siempre",
    icono: Crown,
    destacado: false,
    texto: "Un solo acceso. Sin renovaciones. MyMoney PRO contigo de por vida.",
  },
];

const BENEFICIOS = [
  "Panel financiero completo",
  "Registro de gastos e ingresos por voz",
  "Seguimiento de patrimonio e inversiones",
  "Histórico y análisis financieros",
  "Alertas y automatizaciones",
  "Experiencia PRO sin anuncios",
];

export default function PlanesPage() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-7 sm:p-10">
        <Sparkle className="absolute right-8 top-8 size-10 text-primary/20" weight="fill" />
        <Sparkle className="absolute bottom-8 left-1/3 size-5 text-violet-500/20" weight="fill" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Crown weight="fill" className="size-4" /> MyMoney PRO
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Elige cómo quieres llevar el control.</h1>
          <p className="mt-3 text-muted-foreground leading-7">Más claridad, más automatización y una experiencia financiera diseñada para acompañarte.</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLANES.map((plan) => {
          const Icon = plan.icono;
          return (
            <article key={plan.nombre} className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-transform hover:-translate-y-1 ${plan.destacado ? "border-primary bg-primary/[0.04] ring-2 ring-primary/20" : "border-border bg-card"}`}>
              {plan.destacado && <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">Más elegido</span>}
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" weight="duotone" /></div>
              <h2 className="mt-5 text-lg font-bold">{plan.nombre}</h2>
              <p className="mt-2 min-h-12 text-sm leading-5 text-muted-foreground">{plan.texto}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight">{plan.precio}</span>
                <span className="text-sm text-muted-foreground">{plan.periodo}</span>
              </div>
              <button type="button" className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 ${plan.destacado ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-accent"}`}>
                Elegir plan
              </button>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Crown weight="fill" className="size-5" /></div><div><h2 className="font-bold">Todo lo que incluye PRO</h2><p className="text-sm text-muted-foreground">Una experiencia financiera completa.</p></div></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map((beneficio) => <div key={beneficio} className="flex items-center gap-2 text-sm"><Check className="size-5 shrink-0 text-primary" weight="bold" />{beneficio}</div>)}
        </div>
      </section>

      <div className="flex justify-center"><Link href="/tracking/patrimonio" className="text-sm font-medium text-muted-foreground hover:text-foreground">Volver al dashboard</Link></div>
    </div>
  );
}
