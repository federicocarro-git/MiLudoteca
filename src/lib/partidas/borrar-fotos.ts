import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { BUCKET_FOTOS } from "./fotos";

/**
 * Borra las fotos de una partida antes de borrarla (Storage no borra en
 * cascada). Si falla, no corta: quedarían archivos sueltos, no datos rotos.
 */
export async function borrarFotosDePartida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partidaId: string,
) {
  const { data: fotos } = await supabase.storage.from(BUCKET_FOTOS).list(partidaId);
  if (!fotos?.length) return;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .remove(fotos.map((f) => `${partidaId}/${f.name}`));
  if (error) console.error("borrarFotosDePartida", partidaId, error);
}
