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
      {/* Saltar la navegación: con un sidebar de 14 enlaces, llegar al contenido
          con el teclado exigía tabular por todos ellos en cada página. */}
      <a
        href="#contenido"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <Sidebar email={user?.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="contenido" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:py-10">
          {children}
        </main>
      </div>
      <VozFab />
    </div>
  );
}
