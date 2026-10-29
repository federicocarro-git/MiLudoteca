"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { importarTanda } from "@/lib/coleccion-bgg/importar";
import { planificarImportacion } from "@/lib/coleccion-bgg/planificar";
import { ErrorGameData, getGameDataProvider } from "@/lib/game-data";
import { CacheSupabase } from "@/lib/game-data/bgg/cache-supabase";
import type { ItemColeccion } from "@/lib/game-data/types";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { nombrePerfilSchema } from "@/lib/validations/amigos";
import { tandaBggSchema, usuarioBggSchema } from "@/lib/validations/bgg";

const SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar.";

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type EstadoNombre = (Resultado<null> & { errores?: { nombre?: string } }) | null;

/** Nombre visible para los amigos y en las salas. */
export async function actualizarNombre(
  _previo: EstadoNombre,
  formData: FormData,
): Promise<EstadoNombre> {
  const parseo = nombrePerfilSchema.safeParse(formData.get("nombre") ?? "");
  if (!parseo.success) {
    const error = parseo.error.issues[0].message;
    return { ok: false, error, errores: { nombre: error } };
  }
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ nombre: parseo.data })
    .eq("id", usuario.id)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("actualizarNombre", error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

/** Si tus amigos y quienes juegan con vos en una sala ven tu catálogo. */
export async function cambiarVisibilidadCatalogo(visible: boolean): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ catalogo_visible: visible === true })
    .eq("id", usuario.id)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("cambiarVisibilidadCatalogo", error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// BoardGameGeek: vincular el usuario e importar la colección
// -----------------------------------------------------------------------------

export type EstadoVincularBgg = (Resultado<null> & { errores?: { usuario?: string } }) | null;

/** Guarda el usuario de BGG (no hace falta contraseña: la colección es pública). */
export async function vincularBgg(
  _previo: EstadoVincularBgg,
  formData: FormData,
): Promise<EstadoVincularBgg> {
  const parseo = usuarioBggSchema.safeParse(formData.get("usuario") ?? "");
  if (!parseo.success) {
    const error = parseo.error.issues[0].message;
    return { ok: false, error, errores: { usuario: error } };
  }
  return guardarUsuarioBgg(parseo.data);
}

/** Deja de vincular la cuenta. Los juegos ya importados se quedan en el estante. */
export async function desvincularBgg(): Promise<Resultado<null>> {
  return guardarUsuarioBgg(null);
}

async function guardarUsuarioBgg(usuarioBgg: string | null): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ bgg_usuario: usuarioBgg, bgg_importado_en: null })
    .eq("id", usuario.id)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("guardarUsuarioBgg", error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

function errorDeBgg(error: unknown, usuarioBgg?: string): string {
  if (error instanceof ErrorGameData) {
    if (error.codigo === "usuario_inexistente") {
      return `No existe el usuario "${usuarioBgg}" en BoardGameGeek. Revisá cómo está escrito.`;
    }
    if (error.codigo === "no_disponible") {
      return `${error.message} Probá de nuevo en un minuto.`;
    }
    return error.message;
  }
  console.error("BGG", error);
  return "No se pudo traer la colección de BGG. Probá de nuevo.";
}

export type ColeccionParaImportar = {
  usuario: string;
  nuevos: ItemColeccion[];
  yaEstaban: number;
};

/** Lee la colección de BGG y devuelve lo que falta en el estante. */
export async function leerColeccionBgg(): Promise<Resultado<ColeccionParaImportar>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  const provider = getGameDataProvider();
  if (!provider) return { ok: false, error: "La conexión con BGG no está disponible." };

  const supabase = await createClient();
  const [{ data: perfil }, { data: estante, error }] = await Promise.all([
    supabase.from("perfiles").select("bgg_usuario").eq("id", usuario.id).maybeSingle(),
    supabase.from("mi_catalogo").select("bgg_id, nombre"),
  ]);
  if (error) {
    console.error("leerColeccionBgg", error);
    return { ok: false, error: "No se pudo leer tu estante. Probá de nuevo." };
  }
  const usuarioBgg = perfil?.bgg_usuario;
  if (!usuarioBgg) return { ok: false, error: "Primero vinculá tu usuario de BGG." };

  try {
    const coleccion = await provider.coleccion(usuarioBgg);
    const plan = planificarImportacion(
      coleccion,
      estante.flatMap((j) => (j.nombre ? [{ bgg_id: j.bgg_id, nombre: j.nombre }] : [])),
    );
    return { ok: true, data: { usuario: usuarioBgg, ...plan } };
  } catch (error) {
    return { ok: false, error: errorDeBgg(error, usuarioBgg) };
  }
}

/** Agrega una tanda (hasta 20) de la colección al estante. */
export async function importarTandaBgg(
  tanda: unknown,
): Promise<Resultado<{ agregados: number; sinDatos: number }>> {
  const parseo = tandaBggSchema.safeParse(tanda);
  if (!parseo.success) return { ok: false, error: "La lista de juegos no es válida." };
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  const provider = getGameDataProvider();
  if (!provider) return { ok: false, error: "La conexión con BGG no está disponible." };

  const supabase = await createClient();
  try {
    const resultado = await importarTanda(parseo.data, {
      provider,
      supabase,
      cache: new CacheSupabase(),
    });
    await supabase
      .from("perfiles")
      .update({ bgg_importado_en: new Date().toISOString() })
      .eq("id", usuario.id);
    return { ok: true, data: resultado };
  } catch (error) {
    return { ok: false, error: errorDeBgg(error) };
  }
}

/** Al terminar la importación: que el estante y la cuenta muestren lo nuevo. */
export async function terminarImportacionBgg(): Promise<Resultado<null>> {
  refresh();
  return { ok: true, data: null };
}
