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
