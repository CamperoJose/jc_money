import Link from "next/link";
import { ArrowRight, ArrowUpRight, ArrowDownRight, ChartLineUp, CheckCircle, Clock, Coins, CreditCard, Microphone, PiggyBank, Sparkle, Target, TrendUp, WarningCircle, Wallet } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { fechaBoliviaHoy } from "@/lib/datetime";
import { getResumen } from "@/lib/queries/patrimonio";
import { getResumenDpf } from "@/lib/queries/dpf";
import { getResumenDeudas } from "@/lib/queries/deudas";
import { getResumenGastos } from "@/lib/queries/gastos";
import { calcularEstadoPatrimonio, disponibilidadDe } from "@/lib/patrimonio/estado";
import { formatBob, formatDate, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function money(value: number | null | undefined) { return value == null ? "—" : formatBob(value); }
function signedPercent(value: number | null) { return value == null ? "Sin comparación" : `${value >= 0 ? "+" : ""}${formatPercent(value)}`; }

export default async function DashboardGeneralPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hoy = fechaBoliviaHoy();
  const [p, d, debt, g, live] = await Promise.allSettled([
    getResumen(supabase), getResumenDpf(supabase), getResumenDeudas(supabase), getResumenGastos(supabase),
    user ? calcularEstadoPatrimonio(supabase, user.id, hoy) : Promise.resolve(null),
  ]);
  const patrimonio = p.status === "fulfilled" ? p.value : null;
  const dpf = d.status === "fulfilled" ? d.value : null;
  const deudas = debt.status === "fulfilled" ? debt.value : null;
  const gastos = g.status === "fulfilled" ? g.value : null;
  const estado = live.status === "fulfilled" ? live.value : null;

  const nombre = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.split(" ")[0] : typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.split(" ")[0] : "de nuevo";
  const patrimonioBob = estado?.totalBob ?? patrimonio?.ultimo?.total_bob ?? null;
  const disponible = estado ? disponibilidadDe(estado) : patrimonio?.disponibilidadRapida ?? null;
  const gastoMes = gastos?.totalMesBob ?? null;
  const ingresoMes = gastos?.porMes.at(-1)?.ingresoBob ?? 0;
  const ahorroMes = ingresoMes > 0 && gastoMes != null ? ingresoMes - gastoMes : null;
  const proximoDpf = dpf?.proximo;
  const categorias = gastos?.porCategoria.slice(0, 4) ?? [];
  const maxCategoria = categorias[0]?.montoBob ?? 1;

  const alertas = [
    ...(deudas?.porCobrarVencido ? [{ title: "Hay dinero por cobrar", text: `${money(deudas.porCobrarVencido)} está vencido`, href: "/tracking/deudas", icon: WarningCircle, warning: true }] : []),
    ...(dpf?.dpfsVencidos ? [{ title: "DPF vencido", text: `${dpf.dpfsVencidos} requiere atención`, href: "/tracking/inversiones/dpf", icon: Clock, warning: true }] : []),
    ...(proximoDpf && proximoDpf.diasRestantes >= 0 && proximoDpf.diasRestantes <= 30 ? [{ title: "DPF próximo a vencer", text: `${proximoDpf.diasRestantes} días · ${money(proximoDpf.principal)}`, href: "/tracking/inversiones/dpf", icon: Coins, warning: false }] : []),
    ...(gastos?.variacionMesPct != null && gastos.variacionMesPct > 0.15 ? [{ title: "Tus gastos aceleraron", text: `${signedPercent(gastos.variacionMesPct)} vs. mes anterior`, href: "/tracking/gastos", icon: TrendUp, warning: true }] : []),
  ].slice(0, 3);

  const insight = ahorroMes != null ? ahorroMes > 0 ? `Este mes llevas ${money(ahorroMes)} de diferencia entre ingresos y gastos. Tu siguiente objetivo debería ser proteger ese excedente.` : `Este mes tus gastos superan tus ingresos en ${money(Math.abs(ahorroMes))}. Revisa Presupuestos antes de que cierre el mes.` : gastoMes != null ? `Llevas ${money(gastoMes)} gastados este mes. Usa el asistente de voz para registrar movimientos en segundos.` : "Empieza registrando un movimiento. El dashboard irá construyendo una lectura personalizada de tus finanzas.";

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-background to-background p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Sparkle weight="fill" className="size-4" /> Centro financiero</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hola, {nombre} 👋</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Una vista rápida de lo que importa hoy. No necesitas recorrer todos los módulos para saber cómo estás.</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link href="/tracking/gastos/registros">+ Registrar gasto</Link></Button><Button asChild variant="outline" size="sm"><Link href="/tracking/asistente"><Microphone weight="bold" className="size-4" /> Hablar con MyMoney</Link></Button></div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Patrimonio neto" value={money(patrimonioBob)} detail={patrimonio?.variacionTotalPct == null ? "Tu posición actual" : `${signedPercent(patrimonio.variacionTotalPct)} desde el inicio`} icon={Wallet} tone="primary" />
      <KpiCard label="Disponible ahora" value={money(disponible)} detail="Dinero líquido · sin DPF" icon={CreditCard} tone="neutral" />
      <KpiCard label="Gasto del mes" value={money(gastoMes)} detail={gastos?.variacionMesPct == null ? "Sin comparación" : `${signedPercent(gastos.variacionMesPct)} vs. mes anterior`} icon={ArrowDownRight} tone={gastos?.variacionMesPct != null && gastos.variacionMesPct > 0 ? "danger" : "positive"} />
      <KpiCard label="Invertido en DPF" value={money(dpf?.montoEnDpf)} detail={dpf?.tasaPromedio == null ? "Sin DPF activos" : `${formatPercent(dpf.tasaPromedio)} tasa promedio`} icon={PiggyBank} tone="violet" />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
      <Card className="overflow-hidden"><CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/60 pb-4"><div><CardTitle className="flex items-center gap-2 text-base"><ChartLineUp className="size-5 text-primary" /> Evolución de tus ingresos</CardTitle><p className="mt-1 text-xs text-muted-foreground">Una lectura compacta de tu actividad reciente.</p></div><Link href="/tracking/patrimonio/tendencias" className="text-xs font-medium text-primary hover:underline">Ver tendencias</Link></CardHeader><CardContent className="pt-5">{gastos?.porMes?.length ? <div className="space-y-4"><div className="flex h-36 items-end gap-1.5">{gastos.porMes.slice(-12).map((item) => { const max = Math.max(...gastos.porMes.slice(-12).map((x) => Math.max(x.ingresoBob, x.gastoBob)), 1); const height = Math.max(5, ((item.ingresoBob || item.gastoBob) / max) * 100); return <div key={item.periodo} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-8 rounded-t-md bg-primary/75 transition-all hover:bg-primary" style={{ height: `${height}%` }} title={`${item.periodo}: ingresos ${money(item.ingresoBob)} · gastos ${money(item.gastoBob)}`} /><span className="text-[9px] text-muted-foreground">{item.periodo.slice(5)}</span></div>; })}</div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-emerald-500/10 px-4 py-3"><span className="text-muted-foreground">Ingresos recientes</span><strong className="mt-1 block tabular-nums">{money(ingresoMes)}</strong></div><div className="rounded-xl bg-rose-500/10 px-4 py-3"><span className="text-muted-foreground">Gastos recientes</span><strong className="mt-1 block tabular-nums">{money(gastoMes)}</strong></div></div></div> : <Empty text="Aún no hay suficiente actividad para mostrar una tendencia." href="/tracking/gastos/registros" label="Registrar movimiento" />}</CardContent></Card>
      <Card><CardHeader className="space-y-1"><CardTitle className="flex items-center gap-2 text-base"><Sparkle className="size-5 text-primary" /> Lectura inteligente</CardTitle><p className="text-xs text-muted-foreground">Lo que MyMoney quiere que sepas hoy.</p></CardHeader><CardContent><div className="rounded-2xl bg-primary/[0.07] p-4"><div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkle weight="fill" className="size-5" /></div><p className="text-sm leading-6">{insight}</p><Link href="/tracking/asistente" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Preguntar al asistente <ArrowRight className="size-3.5" /></Link></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><MiniStat label="Por cobrar" value={money(deudas?.totalPorCobrar)} href="/tracking/deudas" /><MiniStat label="Interés DPF" value={money(dpf?.gananciaLiquida)} href="/tracking/inversiones/dpf" /></div></CardContent></Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><div><CardTitle className="text-base">Gastos del mes</CardTitle><p className="mt-1 text-xs text-muted-foreground">Dónde se está yendo tu dinero.</p></div><Link href="/tracking/gastos" className="text-xs text-primary hover:underline">Abrir</Link></CardHeader><CardContent className="space-y-4">{categorias.length ? categorias.map((cat) => <div key={cat.nombre}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate">{cat.nombre}</span><span className="font-semibold tabular-nums">{money(cat.montoBob)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(4, (cat.montoBob / maxCategoria) * 100)}%` }} /></div></div>) : <Empty text="Registra gastos para ver tus principales categorías." href="/tracking/gastos/registros" label="Ver movimientos" />}</CardContent></Card>

      <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><div><CardTitle className="text-base">Próximos eventos</CardTitle><p className="mt-1 text-xs text-muted-foreground">Cosas que podrían requerir acción.</p></div><Clock className="size-5 text-muted-foreground" /></CardHeader><CardContent className="space-y-3">{proximoDpf ? <EventRow icon={Coins} title="Vencimiento DPF" detail={`${money(proximoDpf.principal)} · ${proximoDpf.diasRestantes < 0 ? "vencido" : `${proximoDpf.diasRestantes} días`}`} href="/tracking/inversiones/dpf" /> : null}{deudas?.deudas.filter((x) => x.outstanding > 0).slice(0, 2).map((deuda) => <EventRow key={deuda.id} icon={Target} title={deuda.counterparty || "Por cobrar"} detail={`${money(deuda.outstanding)}${deuda.vencida ? " · vencida" : ""}`} href="/tracking/deudas" />)}{!proximoDpf && !deudas?.deudas.some((x) => x.outstanding > 0) ? <Empty text="No tienes eventos pendientes detectados." href="/tracking" label="Explorar" /> : null}</CardContent></Card>

      <Card><CardHeader className="pb-3"><CardTitle className="text-base">Estado de atención</CardTitle><p className="mt-1 text-xs text-muted-foreground">Prioridades para hoy.</p></CardHeader><CardContent className="space-y-3">{alertas.length ? alertas.map((a) => <Link key={a.title} href={a.href} className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-muted/60"><span className={a.warning ? "mt-0.5 text-amber-600" : "mt-0.5 text-blue-600"}><a.icon className="size-5" weight="fill" /></span><span className="min-w-0"><span className="block text-xs font-semibold">{a.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{a.text}</span></span></Link>) : <div className="rounded-xl bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle weight="fill" className="size-5 text-emerald-600" /> Todo tranquilo</div><p className="mt-1 text-xs text-muted-foreground">No detectamos ninguna prioridad urgente con los datos actuales.</p></div>}</CardContent></Card>
    </section>

    <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold"><Microphone weight="fill" className="size-5 text-primary" /> Registra sin navegar</div><p className="mt-1 text-xs text-muted-foreground">Di algo como “gasté 45 Bs en almuerzo” y MyMoney te pedirá confirmar antes de guardar.</p></div><Button asChild variant="outline" size="sm"><Link href="/tracking/asistente">Abrir asistente <ArrowRight className="size-4" /></Link></Button></div></section>
  </div>;
}

function KpiCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Wallet; tone: "primary" | "neutral" | "danger" | "positive" | "violet" }) { const iconClass = tone === "danger" ? "text-rose-600 bg-rose-500/10" : tone === "positive" ? "text-emerald-600 bg-emerald-500/10" : tone === "violet" ? "text-violet-600 bg-violet-500/10" : tone === "primary" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"; return <Card className="transition-transform duration-200 hover:-translate-y-0.5"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p></div><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}><Icon weight="fill" className="size-5" /></span></div><p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p></CardContent></Card>; }
function MiniStat({ label, value, href }: { label: string; value: string; href: string }) { return <Link href={href} className="rounded-xl border border-border/70 p-3 transition-colors hover:bg-muted/60"><span className="block text-muted-foreground">{label}</span><span className="mt-1 block font-semibold tabular-nums">{value}</span></Link>; }
function EventRow({ icon: Icon, title, detail, href }: { icon: typeof Wallet; title: string; detail: string; href: string }) { return <Link href={href} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon weight="fill" className="size-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span><ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" /></Link>; }
function Empty({ text, href, label }: { text: string; href: string; label: string }) { return <div className="py-5 text-center"><p className="text-xs text-muted-foreground">{text}</p><Link href={href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{label} <ArrowRight className="size-3.5" /></Link></div>; }
