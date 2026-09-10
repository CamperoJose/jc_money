import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/tracking/sidebar";
import { VozFab } from "@/components/voz/voz-fab";
import { ProveedorAvisos } from "@/components/ui/toast";
import { ProWelcome } from "@/components/pro/pro-welcome";

export default async function TrackingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let mostrarOferta = false;
  if (user) {
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", "pro_offer_seen")
      .maybeSingle();
    mostrarOferta = setting?.value !== "true";
  }

  return (
    <ProveedorAvisos>
      <div className="relative min-h-dvh bg-background lg:flex">
        <a href="#contenido" className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground">Saltar al contenido</a>
        <Sidebar email={user?.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="contenido" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:py-10 lg:pb-[calc(2rem+env(safe-area-inset-bottom))]">{children}</main>
        </div>
        <VozFab />
        {mostrarOferta && <ProWelcome />}
      </div>
    </ProveedorAvisos>
  );
}
