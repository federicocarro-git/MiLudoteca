import { normalizar } from "@/lib/game-data/texto";
import type { ItemColeccion } from "@/lib/game-data/types";

// Qué traer de la colección de BGG: lo que todavía no está en el estante.
// Nunca se quita nada: lo que se sacó de BGG queda (si alguien lo quiere
// quitar, lo hace a mano).

/** Lo mínimo de un juego del estante para saber si ya está. */
export type EnEstante = { bgg_id: number | null; nombre: string };

/** Juegos por tanda en la importación (lo que BGG acepta en un pedido a `thing`). */
export const JUEGOS_POR_TANDA = 20;

/**
 * Los juegos de la colección que faltan en el estante. Ya está si coincide el
 * bgg_id (también un juego manual que lo guarda de referencia) o el nombre
 * (sin tildes ni mayúsculas: un "Catan" cargado a mano antes de vincular).
 * Primero los juegos base y después las expansiones.
 */
export function planificarImportacion(
  coleccion: ItemColeccion[],
  estante: EnEstante[],
): { nuevos: ItemColeccion[]; yaEstaban: number } {
  const ids = new Set(estante.flatMap((j) => j.bgg_id ?? []));
  const nombres = new Set(estante.map((j) => normalizar(j.nombre)));
  const nuevos = coleccion.filter(
    (item) => !ids.has(item.bgg_id) && !nombres.has(normalizar(item.nombre)),
  );
  nuevos.sort((a, b) => Number(a.es_expansion) - Number(b.es_expansion));
  return { nuevos, yaEstaban: coleccion.length - nuevos.length };
}

/** Parte la lista en tandas para importarlas de a una (con progreso). */
export function enTandas<T>(items: T[], tamano = JUEGOS_POR_TANDA): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) tandas.push(items.slice(i, i + tamano));
  return tandas;
}
