import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Esta página no existe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el enlace esté mal escrito o que la pantalla se haya movido.
        </p>
        <Link
          href="/tracking/patrimonio"
          className="mt-6 inline-flex h-9 items-center rounded-md bg-primary bg-gradient-to-b from-white/15 to-transparent px-4 text-sm font-medium text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10"
        >
          Ir a Patrimonio
        </Link>
      </div>
    </main>
  );
}
