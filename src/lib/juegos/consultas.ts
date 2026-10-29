import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuid = (id: string) => UUID.test(id);

/**
 * Un juego visible para el usuario (RLS) con sus datos de catálogo, si lo
 * tiene. `cache` evita repetir la consulta entre el layout y la página en un
 * mismo request. Lee cookies: usar dentro de <Suspense>.
 */
export const obtenerJuego = cache(async (id: string) => {
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const [{ data, error }, { data: claims }] = await Promise.all([
    supabase
      .from("juegos")
      .select("*, catalogo_usuario(notas, puntuacion, agregado_en)")
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getClaims(),
  ]);
  if (error) throw error;
  if (!data) return null;
  const { catalogo_usuario, ...juego } = data;
  return {
    juego,
    // RLS deja ver solo la fila propia de catalogo_usuario.
    catalogo: catalogo_usuario[0] ?? null,
    /** Solo se pueden editar los juegos manuales propios. */
    editable: juego.origen === "manual" && juego.creado_por === claims?.claims.sub,
  };
});

/** Resumen del usuario actual para un juego (RLS: solo los propios). */
export const obtenerResumen = cache(async (juegoId: string) => {
  if (!esUuid(juegoId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumenes")
    .select("como_se_juega, hoja_de_turno, actualizado_en")
    .eq("juego_id", juegoId)
    .maybeSingle();
  if (error) throw error;
  return data;
});

export type JuegoRelacionado = { id: string; nombre: string; imagen_url: string | null };

/**
 * Las expansiones de un juego base que el usuario tiene en su estante, o los
 * juegos base de una expansión (los de BGG que ya están en la base). Lee
 * cookies: usar dentro de <Suspense>.
 */
export async function obtenerRelacionados(juego: {
  bgg_id: number | null;
  es_expansion: boolean;
  expande: number[];
}): Promise<{ expansiones: JuegoRelacionado[]; bases: JuegoRelacionado[] }> {
  const supabase = await createClient();
  if (juego.es_expansion) {
    if (juego.expande.length === 0) return { expansiones: [], bases: [] };
    const { data, error } = await supabase
      .from("juegos")
      .select("id, nombre, imagen_url")
      .eq("origen", "bgg")
      .in("bgg_id", juego.expande)
      .order("nombre");
    if (error) throw error;
    return { expansiones: [], bases: data };
  }
  if (juego.bgg_id === null) return { expansiones: [], bases: [] };
  const { data, error } = await supabase
    .from("mi_catalogo")
    .select("id, nombre, imagen_url")
    .eq("es_expansion", true)
    .contains("expande", [juego.bgg_id])
    .order("nombre");
  if (error) throw error;
  return {
    expansiones: data.flatMap((e) =>
      e.id && e.nombre ? [{ id: e.id, nombre: e.nombre, imagen_url: e.imagen_url }] : [],
    ),
    bases: [],
  };
}
