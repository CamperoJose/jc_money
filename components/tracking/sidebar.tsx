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
  SignOut,
  List as ListIcon,
  X,
  CaretDoubleLeft,
  CaretDoubleRight,
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
    ],
  },
  { label: "Gastos", icon: Wallet, ready: false },
  { label: "Inversiones", icon: Bank, ready: false },
  { label: "Deudas", icon: HandCoins, ready: false },
];

const STORAGE_KEY = "mymoney.sidebar.collapsed";

export function Sidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Recuerda la preferencia de colapso (por-dispositivo).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);
  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const contenido = (mini: boolean) => (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className={cn("flex items-center py-5", mini ? "justify-center px-2" : "justify-between px-5")}>
        {!mini && (
          <Link
            href="/tracking/patrimonio"
            className="text-lg font-bold text-sidebar-primary"
            onClick={() => setOpenMobile(false)}
          >
            MyMoney
          </Link>
        )}
        {mini && <span className="text-lg font-bold text-sidebar-primary">M</span>}
        <button
          type="button"
          className="rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 lg:hidden"
          onClick={() => setOpenMobile(false)}
          aria-label="Cerrar menú"
        >
          <X weight="bold" className="size-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3">
        {GROUPS.map((g) => {
          if (g.items) {
            return (
              <div key={g.label} className="pb-1">
                {!mini && (
                  <div className="flex items-center gap-2 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                    <g.icon weight="duotone" className="size-4" />
                    {g.label}
                  </div>
                )}
                {mini && <div className="my-1 border-t border-sidebar-border/60" />}
                {g.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                      title={mini ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                        mini ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon weight={active ? "fill" : "duotone"} className="size-4 shrink-0" />
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
                "flex cursor-not-allowed items-center gap-3 rounded-md text-sm font-medium text-sidebar-foreground/35",
                mini ? "justify-center px-2 py-2.5" : "px-3 py-2"
              )}
            >
              <g.icon weight="duotone" className="size-4 shrink-0" />
              {!mini && (
                <>
                  {g.label}
                  <span className="ml-auto text-[10px] uppercase tracking-wide">pronto</span>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Pie: colapsar (desktop) + usuario + salir */}
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            "mb-1 hidden w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex",
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
          <div className="truncate px-3 pb-2 text-xs text-sidebar-foreground/60" title={email}>
            {email}
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title={mini ? "Salir" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              mini ? "justify-center px-2" : "px-3"
            )}
          >
            <SignOut weight="bold" className="size-4 shrink-0" />
            {!mini && "Salir"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra superior móvil */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="rounded-md p-1 text-foreground hover:bg-accent"
          aria-label="Abrir menú"
        >
          <ListIcon weight="bold" className="size-5" />
        </button>
        <span className="text-base font-bold text-primary">MyMoney</span>
      </div>

      {/* Sidebar desktop (ancho animado) */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out lg:sticky lg:top-0 lg:block lg:h-screen",
          collapsed ? "lg:w-[68px]" : "lg:w-64"
        )}
      >
        {contenido(collapsed)}
      </aside>

      {/* Drawer móvil */}
      {openMobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar shadow-xl">
            {contenido(false)}
          </aside>
        </div>
      )}
    </>
  );
}
