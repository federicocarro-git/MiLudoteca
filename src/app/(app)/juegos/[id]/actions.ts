"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import { BUCKET_IMAGENES, rutaImagenPropia } from "@/lib/juegos/storage";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { catalogoSchema } from "@/lib/validations/catalogo";
import {
  datosDesdeFormData,
  erroresPorCampo,
  juegoFormularioSchema,
} from "@/lib/validations/juego";
import type { EstadoGuardarJuego } from "../nuevo/actions";

const SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Borra una imagen del bucket si es del usuario (si falla, no corta el flujo). */
async function borrarImagenPropia(supabase: Supabase, url: string | null, userId: string) {
  const ruta = rutaImagenPropia(url, userId);
  if (!ruta) return;
  const { error } = await supabase.storage.from(BUCKET_IMAGENES).remove([ruta]);
  if (error) console.error("No se pudo borrar la imagen", ruta, error);
}

export type EstadoCatalogo = Resultado<null> & {
  errores?: Partial<Record<"puntuacion" | "notas", string>>;
};

export async function actualizarCatalogo(
  juegoId: string,
  _previo: EstadoCatalogo | null,
  formData: FormData,
): Promise<EstadoCatalogo> {
  const parseo = catalogoSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    return { ok: false, error: "Revisá los datos.", errores: erroresPorCampo(parseo.error.issues) };
  }
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_usuario")
    .update(parseo.data)
    .eq("juego_id", juegoId)
    .eq("user_id", usuario.id)
    .select("juego_id");
  if (error || data.length === 0) {
    if (error) console.error("actualizarCatalogo", juegoId, error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

export async function agregarAlCatalogo(juegoId: string): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalogo_usuario")
    .insert({ juego_id: juegoId, user_id: usuario.id });
  // 23505: ya estaba; para la persona es lo mismo.
  if (error && error.code !== "23505") {
    console.error("agregarAlCatalogo", juegoId, error);
    return { ok: false, error: "No se pudo agregar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

/**
 * Quita el juego del catálogo. Si es un juego manual propio, además lo borra
 * (con sus resúmenes y su foto): nadie más puede verlo, así que quedaría
 * huérfano. Los juegos de BGG son compartidos y se conservan.
 */
export async function quitarDelCatalogo(juegoId: string): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };
  const supabase = await createClient();

  const { data: juego } = await supabase
    .from("juegos")
    .select("origen, creado_por, imagen_url")
    .eq("id", juegoId)
    .maybeSingle();

  const { error } = await supabase
    .from("catalogo_usuario")
    .delete()
    .eq("juego_id", juegoId)
    .eq("user_id", usuario.id);
  if (error) {
    console.error("quitarDelCatalogo", juegoId, error);
    return { ok: false, error: "No se pudo quitar. Probá de nuevo." };
  }

  if (juego?.origen === "manual" && juego.creado_por === usuario.id) {
    const { error: errorJuego } = await supabase.from("juegos").delete().eq("id", juegoId);
    if (errorJuego) console.error("No se pudo borrar el juego manual", errorJuego);
    else await borrarImagenPropia(supabase, juego.imagen_url, usuario.id);
  }

  redirect("/catalogo");
}

/** Edita los datos de un juego manual propio y su entrada en el catálogo. */
export async function actualizarJuego(
  juegoId: string,
  _previo: EstadoGuardarJuego,
  formData: FormData,
): Promise<EstadoGuardarJuego> {
  const parseo = juegoFormularioSchema.safeParse(datosDesdeFormData(formData));
  if (!parseo.success) {
    return {
      ok: false,
      error: "Revisá los datos marcados.",
      errores: erroresPorCampo(parseo.error.issues),
    };
  }
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { puntuacion, notas, confirmar_duplicado, ...datos } = parseo.data;

  const { data: anterior } = await supabase
    .from("juegos")
    .select("imagen_url")
    .eq("id", juegoId)
    .eq("origen", "manual")
    .eq("creado_por", usuario.id)
    .maybeSingle();
  if (!anterior) return { ok: false, error: "Solo podés editar los juegos que cargaste vos." };

  const { error } = await supabase.from("juegos").update(datos).eq("id", juegoId);
  if (error) {
    console.error("actualizarJuego", juegoId, error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }

  await supabase
    .from("catalogo_usuario")
    .update({ puntuacion, notas })
    .eq("juego_id", juegoId)
    .eq("user_id", usuario.id);

  if (anterior.imagen_url !== datos.imagen_url) {
    await borrarImagenPropia(supabase, anterior.imagen_url, usuario.id);
  }

  redirect(`/juegos/${juegoId}?editado=1`);
}
