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
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}
interface NavGroup {
  label: string;
  icon: Icon;
  ready: boolean;
  items?: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Patrimonio",
    icon: ChartLineUp,
    ready: true,
    items: [
      { href: "/tracking/patrimonio", label: "Dashboard", icon: ChartPieSlice },
      { href: "/tracking/patrimonio/registros", label: "Registros", icon: ListBullets },
      { href: "/tracking/patrimonio/tipo-cambio", label: "Tipo de cambio", icon: CurrencyDollar },
    ],
  },
  {
    label: "Gastos",
    icon: Wallet,
    ready: true,
    items: [
      { href: "/tracking/gastos", label: "Dashboard", icon: ChartPieSlice },
      { href: "/tracking/gastos/registros", label: "Movimientos", icon: Receipt },
    ],
  },
  {
    label: "Inversiones",
    icon: Bank,
    ready: true,
    items: [
      { href: "/tracking/inversiones/dpf", label: "DPF", icon: Vault },
      { href: "/tracking/inversiones/dpf/registros", label: "Registros", icon: ListBullets },
      { href: "/tracking/inversiones/simulador", label: "Simulador", icon: Flask },
    ],
  },
  { label: "Deudas", icon: HandCoins, ready: false },
  {
    label: "Configuración",
    icon: Gear,
    ready: true,
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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <CurrencyCircleDollar weight="fill" className="size-5" />
      </span>
      {!mini && <span className="text-lg font-bold tracking-tight text-sidebar-foreground">MyMoney</span>}
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
                  <div className="flex items-center gap-2 px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                    <g.icon weight="duotone" className="size-3.5" />
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
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon weight={active ? "fill" : "duotone"} className="size-[18px] shrink-0" />
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
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="rounded-lg p-1.5 text-foreground transition-colors hover:bg-accent"
          aria-label="Abrir menú"
        >
          <ListIcon weight="bold" className="size-5" />
        </button>
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <CurrencyCircleDollar weight="fill" className="size-4" />
        </span>
        <span className="text-sm font-semibold text-foreground">{seccionActiva(pathname)}</span>
      </header>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out lg:sticky lg:top-0 lg:block lg:h-screen",
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
            "absolute left-0 top-0 h-full w-[82%] max-w-xs border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out",
            openMobile ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {contenido(false, true)}
        </aside>
      </div>
    </>
  );
}
