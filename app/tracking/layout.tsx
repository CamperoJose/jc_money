import Link from "next/link";
import {
  ChartLineUp,
  Wallet,
  Bank,
  HandCoins,
  SignOut,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/tracking/patrimonio", label: "Patrimonio", icon: ChartLineUp, ready: true },
  { href: "/tracking/gastos", label: "Gastos", icon: Wallet, ready: false },
  { href: "/tracking/inversiones", label: "Inversiones", icon: Bank, ready: false },
  { href: "/tracking/deudas", label: "Deudas", icon: HandCoins, ready: false },
];

export default async function TrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/tracking/patrimonio" className="text-lg font-bold text-primary">
              MyMoney
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.ready ? item.href : "#"}
                  aria-disabled={!item.ready}
                  className={
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (item.ready
                      ? "text-foreground hover:bg-accent hover:text-accent-foreground"
                      : "pointer-events-none text-muted-foreground/50")
                  }
                >
                  <item.icon weight="duotone" className="size-4" />
                  {item.label}
                  {!item.ready && (
                    <span className="text-[10px] uppercase">pronto</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">
              {user?.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                <SignOut weight="bold" className="size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
