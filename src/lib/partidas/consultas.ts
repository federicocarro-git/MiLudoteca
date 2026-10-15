import "server-only";
import { cache } from "react";
import { esUuid } from "@/lib/juegos/consultas";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_FOTOS, autorDeFoto } from "./fotos";

const COLUMNAS_PARTIDA =
  "id, codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id, estado, creada_en, terminada_en, modo_resultado, cooperativo_ganado, notas";
const COLUMNAS_JUGADOR = "id, user_id, nombre, invitado, puntos, gano, posicion, unido_en";

/** Ordena por posición (los cooperativos y empates, por puntos y llegada). */
function ordenarJugadores<T extends { posicion: number | null; puntos: number; unido_en: string }>(
  jugadores: T[],
) {
  return [...jugadores].sort(
    (a, b) =>
      (a.posicion ?? Infinity) - (b.posicion ?? Infinity) ||
      b.puntos - a.puntos ||
      a.unido_en.localeCompare(b.unido_en),
  );
}

/** Una partida en la que jugó el usuario (RLS), con sus jugadores. Lee cookies. */
export const obtenerPartida = cache(async (id: string) => {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partidas")
    .select(`${COLUMNAS_PARTIDA}, partida_jugadores(${COLUMNAS_JUGADOR})`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { partida_jugadores, ...partida } = data;
  return { partida, jugadores: ordenarJugadores(partida_jugadores) };
});

export type Partida = NonNullable<Awaited<ReturnType<typeof obtenerPartida>>>;

export type FotoPartida = { ruta: string; url: string; autorId: string | null };

/** Fotos de una partida, de la más vieja a la más nueva. */
export async function listarFotos(partidaId: string): Promise<FotoPartida[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .list(partidaId, { sortBy: { column: "created_at", order: "asc" } });
  if (error) {
    console.error("listarFotos", partidaId, error);
    return [];
  }
  return data
    .filter((archivo) => archivo.id)
    .map((archivo) => {
      const ruta = `${partidaId}/${archivo.name}`;
      return {
        ruta,
        url: supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl,
        autorId: autorDeFoto(archivo.name),
      };
    });
}

/** Partidas terminadas en las que jugó el usuario, de la más nueva a la más vieja. */
export async function obtenerHistorial() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partidas")
    .select(`${COLUMNAS_PARTIDA}, partida_jugadores(${COLUMNAS_JUGADOR})`)
    .eq("estado", "terminada")
    .order("terminada_en", { ascending: false });
  if (error) throw error;
  return data.map(({ partida_jugadores, ...partida }) => ({
    ...partida,
    jugadores: ordenarJugadores(partida_jugadores),
  }));
}

export type PartidaHistorial = Awaited<ReturnType<typeof obtenerHistorial>>[number];

/** Cuántas veces se jugó un juego (partidas terminadas del usuario) y cuándo fue la última. */
export async function resumenDePartidasDelJuego(juegoId: string) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("partidas")
    .select("terminada_en", { count: "exact" })
    .eq("juego_id", juegoId)
    .eq("estado", "terminada")
    .order("terminada_en", { ascending: false })
    .limit(1);
  if (error) throw error;
  return { cantidad: count ?? 0, ultima: data[0]?.terminada_en ?? null };
}
