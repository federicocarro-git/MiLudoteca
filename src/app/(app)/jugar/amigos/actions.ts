"use server";

import { refresh } from "next/cache";
import { getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { codigoAmigoSchema } from "@/lib/validations/amigos";

const SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar.";

export type EstadoAgregarAmigo = (Resultado<string> & { errores?: { codigo?: string } }) | null;

// Lo que devuelve public.enviar_solicitud_amistad().
const RESPUESTAS: Record<string, Resultado<string>> = {
  enviada: {
    ok: true,
    data: "Le mandaste la solicitud. Cuando la acepte, va a aparecer en tu lista.",
  },
  aceptada: {
    ok: true,
    data: "¡Ya son amigos! Esa persona también te había mandado una solicitud.",
  },
  ya_enviada: { ok: true, data: "Ya le habías mandado una solicitud: falta que la acepte." },
  ya_amigos: { ok: false, error: "Ya son amigos." },
  propio: { ok: false, error: "Ese es tu propio código." },
  no_encontrado: { ok: false, error: "No encontramos a nadie con ese código. Revisalo." },
};

export async function agregarAmigo(
  _previo: EstadoAgregarAmigo,
  formData: FormData,
): Promise<EstadoAgregarAmigo> {
  const parseo = codigoAmigoSchema.safeParse(formData.get("codigo") ?? "");
  if (!parseo.success) {
    const error = parseo.error.issues[0].message;
    return { ok: false, error, errores: { codigo: error } };
  }
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enviar_solicitud_amistad", { codigo: parseo.data });
  const respuesta = data ? RESPUESTAS[data] : undefined;
  if (error || !respuesta) {
    console.error("agregarAmigo", error ?? data);
    return { ok: false, error: "No se pudo mandar la solicitud. Probá de nuevo." };
  }
  if (respuesta.ok) refresh();
  return respuesta.ok ? respuesta : { ...respuesta, errores: { codigo: respuesta.error } };
}

/** Acepta la solicitud que mandó `otroId`. */
export async function aceptarSolicitud(otroId: string): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(otroId)) return { ok: false, error: "Esa solicitud no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("amistades")
    .update({ estado: "aceptada" })
    .eq("solicitante_id", otroId)
    .eq("destinatario_id", usuario.id)
    .select("estado");
  if (error || data.length === 0) {
    if (error) console.error("aceptarSolicitud", otroId, error);
    return { ok: false, error: "No se pudo aceptar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

/**
 * Borra la relación con `otroId`, sea cual sea su estado: rechazar una
 * solicitud recibida, cancelar una enviada o dejar de ser amigos.
 */
export async function borrarAmistad(otroId: string): Promise<Resultado<null>> {
  const usuario = await getUsuarioActual();
  if (!usuario) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(otroId) || otroId === usuario.id)
    return { ok: false, error: "Esa persona no está en tu lista." };

  const supabase = await createClient();
  // RLS deja ver (y borrar) solo las filas donde participo, así que filtrar por
  // el otro alcanza para dar con el par.
  const { error } = await supabase
    .from("amistades")
    .delete()
    .or(`solicitante_id.eq.${otroId},destinatario_id.eq.${otroId}`);
  if (error) {
    console.error("borrarAmistad", otroId, error);
    return { ok: false, error: "No se pudo completar. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}
