import "server-only";
import type { CacheJuegosBgg } from "@/lib/game-data/bgg/bgg-provider";
import type { GameDataProvider } from "@/lib/game-data/types";
import type { createClient } from "@/lib/supabase/server";
import { nombreDeLaEdicion } from "./planificar";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Un juego de una tanda: su bgg_id, la puntuación de BGG y el nombre de su edición. */
export type ItemTanda = { bgg_id: number; puntuacion: number | null; nombre?: string };

/**
 * Agrega una tanda de juegos de la colección de BGG al estante del usuario.
 * 1. Datos de cada juego (cache primero, después BGG, de a 20).
 * 2. Que exista la fila compartida de BGG en `juegos` (la escribe la cache,
 *    con la clave secreta: los usuarios no pueden escribir filas de BGG).
 * 3. Alta en `catalogo_usuario` con la sesión del usuario (RLS), con la
 *    puntuación de BGG. Si ya estaba, no se toca (ni su puntuación).
 * 4. Si la edición que tiene se llama distinto (en español) y nadie eligió
 *    todavía el nombre en español, se usa ese (elegir_nombre_es).
 */
export async function importarTanda(
  tanda: ItemTanda[],
  deps: { provider: GameDataProvider; supabase: Supabase; cache: CacheJuegosBgg },
): Promise<{ agregados: number; sinDatos: number }> {
  const ids = tanda.map((t) => t.bgg_id);
  const detalles = await deps.provider.obtenerDetalles(ids);

  let filas = await filasDeBgg(deps.supabase, ids);
  const faltan = detalles.filter((d) => d.bgg_id && !filas.has(d.bgg_id));
  if (faltan.length > 0) {
    const ahora = new Date();
    for (const datos of faltan) await deps.cache.guardar(datos, ahora);
    filas = await filasDeBgg(deps.supabase, ids);
  }

  const altas = tanda.flatMap((t) => {
    const juegoId = filas.get(t.bgg_id)?.id;
    return juegoId ? [{ juego_id: juegoId, puntuacion: t.puntuacion }] : [];
  });
  if (altas.length === 0) return { agregados: 0, sinDatos: tanda.length };

  const { data, error } = await deps.supabase
    .from("catalogo_usuario")
    .upsert(altas, { onConflict: "user_id,juego_id", ignoreDuplicates: true })
    .select("juego_id");
  if (error) throw error;

  for (const t of tanda) {
    const datos = detalles.find((d) => d.bgg_id === t.bgg_id);
    const fila = filas.get(t.bgg_id);
    const nombre = datos ? nombreDeLaEdicion(t.nombre, datos) : null;
    if (!nombre || !fila || fila.nombreEs) continue;
    const { error: errorNombre } = await deps.supabase.rpc("elegir_nombre_es", {
      juego: fila.id,
      nombre,
    });
    // No es grave: el nombre se puede elegir después desde la Ficha.
    if (errorNombre) console.error("importarTanda: nombre en español", t.bgg_id, errorNombre);
  }
  return { agregados: data.length, sinDatos: tanda.length - altas.length };
}

/** bgg_id → fila compartida de BGG (las que ya existen) y su nombre en español. */
async function filasDeBgg(supabase: Supabase, ids: number[]) {
  const { data, error } = await supabase
    .from("juegos")
    .select("id, bgg_id, nombre_es")
    .eq("origen", "bgg")
    .in("bgg_id", ids);
  if (error) throw error;
  return new Map(
    data.flatMap((f) =>
      f.bgg_id ? [[f.bgg_id, { id: f.id, nombreEs: f.nombre_es }] as const] : [],
    ),
  );
}
