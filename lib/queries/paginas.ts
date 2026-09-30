/** Lee un histórico completo con orden estable. Avanza por las filas recibidas,
 * por si el servidor limita una página a menos de lo solicitado. */
export async function leerTodasLasFilas<T>(
  leerPagina: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (;;) {
    const { data, error } = await leerPagina(filas.length, filas.length + 499);
    if (error) throw new Error(error.message);
    if (!data?.length) return filas;
    filas.push(...data);
  }
}
