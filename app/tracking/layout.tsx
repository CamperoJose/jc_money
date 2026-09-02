import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/tracking/sidebar";

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
    <div className="relative min-h-screen bg-background lg:flex">
      {/* Difuminados de fondo (blobs) para dar profundidad, sin estorbar. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[26rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-1/3 size-[22rem] rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 size-[24rem] rounded-full bg-emerald-500/[0.06] blur-3xl" />
      </div>
      <Sidebar email={user?.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
