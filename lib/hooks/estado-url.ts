"use client";

// Estado de filtros sincronizado con la URL.
//
// Antes los filtros vivían solo en React: filtrabas Movimientos, entrabas a
// editar uno, volvías con el botón atrás y el filtro se había perdido. Tampoco
// se podía guardar ni compartir una vista. Con el estado en la query string, el
// botón atrás recorre los filtros y la URL describe lo que se está viendo.
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Lee y escribe varios parámetros de la URL. */
export function useFiltrosUrl(): {
  obtener: (clave: string, porDefecto?: string) => string;
  asignar: (cambios: Record<string, string | null>) => void;
  limpiar: () => void;
  hayFiltros: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const obtener = useCallback(
    (clave: string, porDefecto = "") => params.get(clave) ?? porDefecto,
    [params]
  );

  const asignar = useCallback(
    (cambios: Record<string, string | null>) => {
      const siguientes = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(cambios)) {
        // Un parámetro vacío no aporta nada: se quita para que la URL quede
        // corta y legible.
        if (v === null || v === "") siguientes.delete(k);
        else siguientes.set(k, v);
      }
      const qs = siguientes.toString();
      // `replace` y no `push`: al teclear en el buscador no queremos una entrada
      // de historial por cada letra.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const limpiar = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [pathname, router]
  );

  const hayFiltros = useMemo(() => params.toString().length > 0, [params]);

  return { obtener, asignar, limpiar, hayFiltros };
}
