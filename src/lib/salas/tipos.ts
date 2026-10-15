import type { Database } from "@/lib/supabase/database.types";

type Tablas = Database["public"]["Tables"];

export type Sala = Pick<
  Tablas["partidas"]["Row"],
  | "id"
  | "codigo"
  | "juego_id"
  | "juego_nombre"
  | "juego_imagen_url"
  | "anfitrion_id"
  | "estado"
  | "creada_en"
>;

export type JugadorSala = Pick<
  Tablas["partida_jugadores"]["Row"],
  "id" | "user_id" | "nombre" | "invitado" | "puntos" | "unido_en"
>;

/** Columnas que se piden de partida_jugadores (servidor y Realtime). */
export const COLUMNAS_JUGADOR = "id, user_id, nombre, invitado, puntos, unido_en";

/** Ids de quienes van ganando (puede haber empate). Nadie si todos tienen 0. */
export function puntajeMasAlto(jugadores: Pick<JugadorSala, "id" | "puntos">[]): Set<string> {
  if (jugadores.length < 2) return new Set();
  const maximo = Math.max(...jugadores.map((j) => j.puntos));
  if (jugadores.every((j) => j.puntos === maximo)) return new Set();
  return new Set(jugadores.filter((j) => j.puntos === maximo).map((j) => j.id));
}

/**
 * Puntos tocados en este celular que el servidor todavía no confirmó.
 * `guardadoEn`: cuándo terminó de guardarse (null mientras no se guardó).
 */
export type Pendiente = { puntos: number; guardadoEn: number | null };

/**
 * Suelta los pendientes que ya están incluidos en una recarga: los que se
 * guardaron antes de que empezara ese pedido. Los demás siguen mandando
 * (una respuesta pedida antes de guardar traería el valor viejo).
 */
export function soltarConfirmados(
  pendientes: Record<string, Pendiente>,
  inicioRecarga: number,
): Record<string, Pendiente> {
  const quedan = Object.entries(pendientes).filter(
    ([, p]) => p.guardadoEn === null || p.guardadoEn > inicioRecarga,
  );
  return quedan.length === Object.keys(pendientes).length ? pendientes : Object.fromEntries(quedan);
}
