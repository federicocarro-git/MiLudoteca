"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { nombrePerfilSchema } from "@/lib/validations/amigos";

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
