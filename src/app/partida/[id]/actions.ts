"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import { borrarFotosDePartida } from "@/lib/partidas/borrar-fotos";
import { BUCKET_FOTOS } from "@/lib/partidas/fotos";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { notasPartidaSchema } from "@/lib/validations/partidas";

const SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar.";

export type EstadoNotas = (Resultado<null> & { errores?: { notas?: string } }) | null;

/** Notas de la partida (solo el anfitrión, por RLS). */
export async function guardarNotas(
  partidaId: string,
  _previo: EstadoNotas,
  formData: FormData,
): Promise<EstadoNotas> {
  const parseo = notasPartidaSchema.safeParse(formData.get("notas") ?? "");
  if (!parseo.success) {
    const error = parseo.error.issues[0].message;
    return { ok: false, error, errores: { notas: error } };
  }
  if (!esUuid(partidaId)) return { ok: false, error: "Esa partida no existe." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partidas")
    .update({ notas: parseo.data || null })
    .eq("id", partidaId)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("guardarNotas", partidaId, error);
    return { ok: false, error: "No se pudieron guardar las notas." };
  }
  refresh();
  return { ok: true, data: null };
}

/** Borra una foto: la propia o, el anfitrión, cualquiera (RLS de Storage). */
export async function borrarFoto(ruta: string): Promise<Resultado<null>> {
  const [partidaId, archivo] = ruta.split("/");
  if (!esUuid(partidaId ?? "") || !archivo || ruta.split("/").length !== 2) {
    return { ok: false, error: "Esa foto no existe." };
  }
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).remove([ruta]);
  if (error || data.length === 0) {
    if (error) console.error("borrarFoto", ruta, error);
    return { ok: false, error: "No se pudo borrar la foto." };
  }
  refresh();
  return { ok: true, data: null };
}

/**
 * El anfitrión borra una partida terminada: sale del historial de todos.
 * Primero las fotos (Storage no las borra en cascada).
 */
export async function borrarPartida(partidaId: string): Promise<Resultado<null>> {
  if (!esUuid(partidaId)) return { ok: false, error: "Esa partida no existe." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  await borrarFotosDePartida(supabase, partidaId);
  const { data, error } = await supabase.from("partidas").delete().eq("id", partidaId).select("id");
  if (error || data.length === 0) {
    if (error) console.error("borrarPartida", partidaId, error);
    return { ok: false, error: "No se pudo borrar la partida." };
  }
  redirect("/jugar/historial");
}
