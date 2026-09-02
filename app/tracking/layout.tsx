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
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar email={user?.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
