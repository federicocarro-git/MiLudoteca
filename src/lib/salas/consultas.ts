import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { codigoSalaSchema } from "@/lib/validations/salas";
import { COLUMNAS_JUGADOR, type JugadorSala, type Sala } from "./tipos";

const COLUMNAS_SALA =
  "id, codigo, juego_id, juego_nombre, juego_imagen_url, anfitrion_id, estado, creada_en";

/**
 * Sala en curso con ese código, si el usuario actual juega en ella (RLS).
 * Lee cookies: usar dentro de <Suspense>.
 */
export const obtenerSala = cache(
  async (codigo: string): Promise<{ sala: Sala; jugadores: JugadorSala[] } | null> => {
    const parseo = codigoSalaSchema.safeParse(codigo);
    if (!parseo.success) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("partidas")
      .select(`${COLUMNAS_SALA}, partida_jugadores(${COLUMNAS_JUGADOR})`)
      .eq("codigo", parseo.data)
      .eq("estado", "en_curso")
      .order("unido_en", { referencedTable: "partida_jugadores" })
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { partida_jugadores, ...sala } = data;
    return { sala, jugadores: partida_jugadores };
  },
);

export type VistaPrevia = {
  juego_nombre: string;
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
