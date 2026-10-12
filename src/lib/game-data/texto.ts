/** Minúsculas y sin tildes, para comparar nombres. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Ordena resultados por relevancia: primero el nombre exacto, después los que
 * empiezan con la consulta y al final el resto (manteniendo el orden original).
 */
export function ordenarPorRelevancia<T extends { nombre: string }>(
  items: T[],
  consulta: string,
): T[] {
  const q = normalizar(consulta);
  const puntaje = (nombre: string) => {
    const n = normalizar(nombre);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    return 2;
  };
  return items
    .map((item, i) => ({ item, i, p: puntaje(item.nombre) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map(({ item }) => item);
}
