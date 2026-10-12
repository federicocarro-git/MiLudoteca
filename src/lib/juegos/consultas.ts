import "server-only";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un juego visible para el usuario (RLS) con sus datos de catálogo, si lo
 * tiene. Lee cookies: usar dentro de <Suspense>.
 */
export async function obtenerJuego(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("juegos")
    .select("*, catalogo_usuario(notas, puntuacion, agregado_en)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { catalogo_usuario, ...juego } = data;
  // RLS deja ver solo la fila propia de catalogo_usuario.
  return { juego, catalogo: catalogo_usuario[0] ?? null };
}
