import { WifiSlash } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Sin conexión · MyMoney" };

/**
 * Página que muestra el service worker cuando no hay red. Es deliberadamente
 * estática y sin datos: mostrar saldos guardados de una visita anterior, sin
 * avisar de que son viejos, sería peor que no mostrar nada.
 */
export default function SinConexion() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiSlash weight="duotone" className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Sin conexión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MyMoney necesita internet para mostrarte cifras al día. No se muestran
          datos guardados de visitas anteriores, porque podrían estar desfasados.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Vuelve a intentarlo cuando recuperes la señal.
        </p>
      </div>
    </main>
  );
}
