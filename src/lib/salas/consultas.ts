import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { codigoSalaSchema } from "@/lib/validations/salas";
import {
  COLUMNAS_ANOTACION,
  COLUMNAS_JUGADOR,
  type Anotacion,
  type JugadorSala,
  type Sala,
} from "./tipos";

const COLUMNAS_SALA =
  "id, codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id, estado, creada_en, tipo_puntaje, rondas, categorias";

/**
 * Sala en curso con ese código, si el usuario actual juega en ella (RLS).
 * Lee cookies: usar dentro de <Suspense>.
 */
export const obtenerSala = cache(
  async (
    codigo: string,
  ): Promise<{ sala: Sala; jugadores: JugadorSala[]; anotaciones: Anotacion[] } | null> => {
    const parseo = codigoSalaSchema.safeParse(codigo);
    if (!parseo.success) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partidas")
      .select(
        `${COLUMNAS_SALA}, partida_jugadores(${COLUMNAS_JUGADOR}), partida_anotaciones(${COLUMNAS_ANOTACION})`,
      )
      .eq("codigo", parseo.data)
      .eq("estado", "en_curso")
      .order("unido_en", { referencedTable: "partida_jugadores" })
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { partida_jugadores, partida_anotaciones, ...sala } = data;
    return { sala, jugadores: partida_jugadores, anotaciones: partida_anotaciones };
  },
);

export type VistaPrevia = {
  /** Null mientras la sala no tiene juego. */
  juego_nombre: string | null;
  juego_imagen_url: string | null;
  anfitrion: string;
  jugadores: number;
  ya_estoy: boolean;
};

/** Lo que se ve de una sala antes de entrar (también sin sesión). */
export const vistaPreviaSala = cache(async (codigo: string): Promise<VistaPrevia | null> => {
  const parseo = codigoSalaSchema.safeParse(codigo);
  if (!parseo.success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ver_sala", { codigo: parseo.data });
  if (error) throw error;
  return data[0] ?? null;
});

export type SalaEnCurso = Pick<Sala, "codigo" | "juego_nombre" | "creada_en"> & {
  jugadores: number;
  soyAnfitrion: boolean;
};

/** Salas en curso donde juega el usuario actual, de la más nueva a la más vieja. */
export async function obtenerMisSalasEnCurso(): Promise<SalaEnCurso[]> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const yo = claims?.claims.sub;
  if (!yo) return [];
  const { data, error } = await supabase
    .from("partidas")
    .select("codigo, juego_nombre, creada_en, anfitrion_id, partida_jugadores(count)")
    .eq("estado", "en_curso")
    .order("creada_en", { ascending: false });
  if (error) throw error;
  return data.map(({ partida_jugadores, anfitrion_id, ...sala }) => ({
    ...sala,
    jugadores: partida_jugadores[0]?.count ?? 0,
    soyAnfitrion: anfitrion_id === yo,
  }));
}

/** Categorías que el usuario guardó para este juego (para empezar la hoja). */
export async function obtenerHojaGuardada(juegoId: string): Promise<string[] | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const yo = claims?.claims.sub;
  if (!yo) return null;
  const { data, error } = await supabase
    .from("hojas_de_puntuacion")
    .select("categorias")
    .eq("juego_id", juegoId)
    .eq("autor_id", yo)
    .maybeSingle();
  if (error) {
    console.error("obtenerHojaGuardada", juegoId, error);
    return null;
  }
  return data?.categorias ?? null;
}
