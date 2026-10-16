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

/**
 * Revancha: otra sala con el mismo juego, la misma forma de anotar y los
 * mismos jugadores (amigos y los que juegan sin celular). Lleva a ella.
 */
export async function armarRevancha(partidaId: string): Promise<Resultado<null>> {
  if (!esUuid(partidaId)) return { ok: false, error: "Esa partida no existe." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revancha", { partida: partidaId });
  const sala = data?.[0];
  if (error || !sala) {
    console.error("armarRevancha", partidaId, error);
    return { ok: false, error: "No se pudo armar la revancha. Probá de nuevo." };
  }
  redirect(`/sala/${sala.codigo}`);
}

/** El anfitrión vuelve a poner en curso una partida recién terminada. */
export async function reabrirPartida(partidaId: string): Promise<Resultado<null>> {
  if (!esUuid(partidaId)) return { ok: false, error: "Esa partida no existe." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data: codigo, error } = await supabase.rpc("reabrir_partida", { partida: partidaId });
  if (error) {
    if (error.hint === "muy_tarde") {
      return { ok: false, error: "Ya pasaron más de 10 minutos: no se puede reabrir." };
    }
    console.error("reabrirPartida", partidaId, error);
    return { ok: false, error: "No se pudo reabrir la partida. Probá de nuevo." };
  }
  redirect(`/sala/${codigo}`);
}
