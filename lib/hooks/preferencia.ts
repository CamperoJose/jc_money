"use client";

// Preferencias de vista que se recuerdan entre visitas (moneda del gráfico,
// rango de tiempo). Antes el toggle BOB/USD volvía a BOB en cada carga.
import { useCallback, useEffect, useState } from "react";

export function usePreferencia<T extends string>(
  clave: string,
  porDefecto: T,
  validos: readonly T[]
): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(porDefecto);

  // Se lee después del montaje: en el servidor no hay localStorage, y leerlo
  // durante el render provocaría un desajuste de hidratación.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(`mymoney.${clave}`) as T | null;
      if (guardado && validos.includes(guardado)) setValor(guardado);
    } catch {
      /* modo privado o almacenamiento bloqueado: se queda el valor por defecto */
    }
    // `validos` es una constante literal en cada uso; no hace falta observarla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const asignar = useCallback(
    (nuevo: T) => {
      setValor(nuevo);
      try {
        localStorage.setItem(`mymoney.${clave}`, nuevo);
      } catch {
        /* si no se puede guardar, la preferencia dura solo esta sesión */
      }
    },
    [clave]
  );

  return [valor, asignar];
}
