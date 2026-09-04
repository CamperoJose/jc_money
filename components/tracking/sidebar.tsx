"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  ChartPieSlice,
  ListBullets,
  Wallet,
  Bank,
  HandCoins,
  Gear,
  Faders,
  Receipt,
  SignOut,
  List as ListIcon,
  X,
  CaretDoubleLeft,
  CaretDoubleRight,
  CurrencyCircleDollar,
  CurrencyDollar,
  Vault,
  Flask,
  Package,
  Target,
  Sparkle,
  Microphone,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/tracking/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}
/** Colores por sección (literales para que Tailwind los incluya). */
interface Tint {
  icon: string; // color del ícono
  active: string; // fondo de la pestaña activa (texto blanco)
  hover: string; // fondo tenue al pasar el mouse
  dot: string; // indicador lateral
}
interface NavGroup {
  label: string;
  icon: Icon;
  ready: boolean;
  tint: Tint;
  items?: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Patrimonio",
    icon: ChartLineUp,
    ready: true,
    tint: { icon: "text-blue-500", active: "bg-blue-600", hover: "hover:bg-blue-500/10", dot: "bg-blue-500" },
    items: [
      { href: "/tracking/patrimonio", label: "Dashboard", icon: ChartPieSlice },
      { href: "/tracking/patrimonio/tendencias", label: "Tendencias", icon: ChartLineUp },
      { href: "/tracking/patrimonio/registros", label: "Registros", icon: ListBullets },
      { href: "/tracking/patrimonio/tipo-cambio", label: "Tipo de cambio", icon: CurrencyDollar },
    ],
  },
  {
    label: "Gastos",
    icon: Wallet,
    ready: true,
    tint: { icon: "text-rose-500", active: "bg-rose-600", hover: "hover:bg-rose-500/10", dot: "bg-rose-500" },
    items: [
      { href: "/tracking/gastos", label: "Dashboard", icon: ChartPieSlice },
      { href: "/tracking/gastos/registros", label: "Movimientos", icon: Receipt },
      { href: "/tracking/gastos/presupuestos", label: "Presupuestos", icon: Target },
    ],
  },
  {
    label: "Inversiones",
    icon: Bank,
    ready: true,
    tint: { icon: "text-violet-500", active: "bg-violet-600", hover: "hover:bg-violet-500/10", dot: "bg-violet-500" },
    items: [
      { href: "/tracking/inversiones/dpf", label: "DPF", icon: Vault },
      { href: "/tracking/inversiones/dpf/registros", label: "Registros", icon: ListBullets },
      { href: "/tracking/inversiones/simulador", label: "Simulador", icon: Flask },
    ],
  },
  {
    label: "Activos",
    icon: Package,
    ready: true,
    tint: { icon: "text-amber-500", active: "bg-amber-600", hover: "hover:bg-amber-500/10", dot: "bg-amber-500" },
    items: [{ href: "/tracking/activos", label: "Bienes vendibles", icon: Package }],
  },
  {
    label: "Deudas",
    icon: HandCoins,
    ready: true,
    tint: { icon: "text-sky-500", active: "bg-sky-600", hover: "hover:bg-sky-500/10", dot: "bg-sky-500" },
    items: [{ href: "/tracking/deudas", label: "Que me deben", icon: HandCoins }],
  },
  {
    label: "Asistente IA",
    icon: Sparkle,
    ready: true,
    tint: { icon: "text-fuchsia-500", active: "bg-fuchsia-600", hover: "hover:bg-fuchsia-500/10", dot: "bg-fuchsia-500" },
    items: [{ href: "/tracking/asistente", label: "Solicitudes por voz", icon: Microphone }],
  },
  {
    label: "Configuración",
    icon: Gear,
    ready: true,
    tint: { icon: "text-slate-400", active: "bg-slate-600", hover: "hover:bg-slate-500/10", dot: "bg-slate-400" },
    items: [{ href: "/tracking/configuracion/parametros", label: "Parámetros", icon: Faders }],
  },
];

const STORAGE_KEY = "mymoney.sidebar.collapsed";

/** Título de la sección activa, para la barra superior móvil. */
function seccionActiva(pathname: string): string {
  for (const g of GROUPS) {
    if (g.items?.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))) {
      return g.label;
    }
  }
  return "MyMoney";
}

export function Sidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  // Cierra el drawer al cambiar de ruta (por si el click no lo cerró).
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const brand = (mini: boolean) => (
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <CurrencyCircleDollar weight="fill" className="size-5" />
      </span>
      {!mini && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          MyMoney
        </span>
      )}
    </div>
  );

  const contenido = (mini: boolean, enDrawer = false) => (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className={cn("flex items-center py-5", mini ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/tracking/patrimonio" onClick={() => setOpenMobile(false)}>
          {brand(mini)}
        </Link>
        {enDrawer && (
          <button
            type="button"
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
            onClick={() => setOpenMobile(false)}
            aria-label="Cerrar menú"
          >
            <X weight="bold" className="size-5" />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {GROUPS.map((g) => {
          if (g.items) {
            return (
              <div key={g.label} className="pb-1.5">
                {!mini && (
                  <div className="flex items-center gap-2 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    <g.icon weight="fill" className={cn("size-3.5", g.tint.icon)} />
                    {g.label}
                  </div>
                )}
                {mini && <div className="my-1.5 border-t border-sidebar-border/60" />}
                {g.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                      title={mini ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                        mini ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        active
                          ? cn(
                              g.tint.active,
                              // Volumen: degradado vertical + filo de luz interior.
                              "bg-gradient-to-b from-white/20 to-transparent text-white shadow-sm ring-1 ring-inset ring-white/15"
                            )
                          : cn(
                              "text-sidebar-foreground/75",
                              g.tint.hover,
                              "hover:bg-gradient-to-r hover:to-transparent hover:text-sidebar-accent-foreground"
                            )
                      )}
                    >
                      {/* Barra indicadora lateral (solo activo, modo expandido) */}
                      {active && !mini && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/80" />
                      )}
                      <item.icon
                        weight={active ? "fill" : "duotone"}
                        className={cn("size-[18px] shrink-0", !active && g.tint.icon)}
                      />
                      {!mini && item.label}
                    </Link>
                  );
                })}
              </div>
            );
          }
          return (
            <div
              key={g.label}
              title={mini ? `${g.label} (pronto)` : undefined}
              className={cn(
                "flex cursor-not-allowed items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/30",
                mini ? "justify-center px-2" : "px-3"
              )}
            >
              <g.icon weight="duotone" className="size-[18px] shrink-0" />
              {!mini && (
                <>
                  {g.label}
                  <span className="ml-auto rounded-full bg-sidebar-accent/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                    pronto
                  </span>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Pie */}
      <div className="border-t border-sidebar-border p-3">
        <ThemeToggle mini={mini} />
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            "mb-1 hidden w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex",
            mini ? "justify-center px-2" : "px-3"
          )}
          title={mini ? "Expandir menú" : "Colapsar menú"}
        >
          {mini ? (
            <CaretDoubleRight weight="bold" className="size-4" />
          ) : (
            <>
              <CaretDoubleLeft weight="bold" className="size-4" />
              Colapsar
            </>
          )}
        </button>
        {!mini && email && (
          <div className="truncate rounded-md px-3 pb-2 pt-1 text-xs text-sidebar-foreground/55" title={email}>
            {email}
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title={mini ? "Salir" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive",
              mini ? "justify-center px-2" : "px-3"
            )}
          >
            <SignOut weight="bold" className="size-[18px] shrink-0" />
            {!mini && "Salir"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra superior móvil (ancho completo) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-accent"
          aria-label="Abrir menú"
        >
          <ListIcon weight="bold" className="size-5" />
        </button>
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <CurrencyCircleDollar weight="fill" className="size-4" />
        </span>
        <span className="text-sm font-semibold text-foreground">{seccionActiva(pathname)}</span>
      </header>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar bg-gradient-to-b from-foreground/[0.03] via-transparent to-primary/[0.06] transition-[width] duration-300 ease-in-out lg:sticky lg:top-0 lg:block lg:h-dvh",
          collapsed ? "lg:w-[68px]" : "lg:w-64"
        )}
      >
        {contenido(collapsed)}
      </aside>

      {/* Drawer móvil */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          openMobile ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!openMobile}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            openMobile ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpenMobile(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-[82%] max-w-xs border-r border-sidebar-border bg-sidebar bg-gradient-to-b from-foreground/[0.03] via-transparent to-primary/[0.06] shadow-2xl transition-transform duration-300 ease-in-out",
            openMobile ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {contenido(false, true)}
        </aside>
      </div>
    </>
  );
}
