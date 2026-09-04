import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/tracking/sidebar";
import { VozFab } from "@/components/voz/voz-fab";

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
    // block en móvil (barra superior + contenido apilados), fila en desktop.
    // Fondo plano, como la plantilla: sin degradados ni blobs que ensucien
    // el contraste de las tarjetas.
    <div className="relative min-h-dvh bg-background lg:flex">
      <Sidebar email={user?.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:py-10">
          {children}
        </main>
      </div>
      <VozFab />
    </div>
  );
}
