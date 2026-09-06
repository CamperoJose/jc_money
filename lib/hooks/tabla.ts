"use client";

// Ordenamiento y paginación para las tablas.
//
// Ninguna tabla se podía ordenar y todas pintaban el 100% de las filas. Con 17
// fotos y 7 movimientos no molestaba, pero Movimientos crece todos los días.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Orden {
  campo: string;
  asc: boolean;
}

/**
 * Ordena una lista por un campo calculado. `valores` mapea cada nombre de campo
 * a la función que extrae el valor comparable de una fila.
 */
export function useOrden<T>(
  filas: T[],
  valores: Record<string, (fila: T) => string | number | null | undefined>,
  inicial: Orden | null = null
): { ordenadas: T[]; orden: Orden | null; ordenarPor: (campo: string) => void } {
  const [orden, setOrden] = useState<Orden | null>(inicial);

  const ordenarPor = useCallback((campo: string) => {
    setOrden((prev) => {
      // Tercer clic: vuelve al orden natural de la lista.
      if (prev?.campo === campo) return prev.asc ? { campo, asc: false } : null;
      return { campo, asc: true };
    });
  }, []);

  const ordenadas = useMemo(() => {
    if (!orden || !valores[orden.campo]) return filas;
    const extraer = valores[orden.campo];
    const signo = orden.asc ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = extraer(a);
      const vb = extraer(b);
      // Los vacíos siempre al final, ordene como ordene: si no, un campo sin
      // dato parece el menor de todos.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * signo;
      return String(va).localeCompare(String(vb), "es") * signo;
    });
  }, [filas, orden, valores]);

  return { ordenadas, orden, ordenarPor };
}

/** Paginación en memoria; devuelve solo la página visible. */
export function usePaginacion<T>(
  filas: T[],
  porPagina = 50
): {
  pagina: T[];
  indice: number;
  paginas: number;
  irA: (n: number) => void;
  desde: number;
  hasta: number;
  total: number;
} {
  const [indice, setIndice] = useState(0);
  const total = filas.length;

  // Al cambiar el filtro cambia la lista: quedarse en la página 3 de un
  // resultado nuevo desorienta. Se vuelve a la primera.
  const totalPrevio = useRef(total);
  useEffect(() => {
    if (totalPrevio.current !== total) {
      totalPrevio.current = total;
      setIndice(0);
    }
  }, [total]);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  // Si al filtrar quedan menos páginas que la actual, no dejar la vista vacía.
  const actual = Math.min(indice, paginas - 1);
  const desde = actual * porPagina;
  const hasta = Math.min(desde + porPagina, total);
  const pagina = useMemo(() => filas.slice(desde, hasta), [filas, desde, hasta]);

  const irA = useCallback(
    (n: number) => setIndice(Math.max(0, Math.min(n, paginas - 1))),
    [paginas]
  );

  return { pagina, indice: actual, paginas, irA, desde, hasta, total };
}
