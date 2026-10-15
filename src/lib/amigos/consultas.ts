import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  nombre: string;
  codigo_amigo: string;
  catalogo_visible: boolean;
};

/** Perfil del usuario actual (null si no hay sesión). Lee cookies: dentro de <Suspense>. */
export const obtenerMiPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) return null;
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, codigo_amigo, catalogo_visible")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
});

export type Amigo = { id: string; nombre: string; desde: string };

export type Amistades = {
  amigos: Amigo[];
  /** Solicitudes que me mandaron (las puedo aceptar o rechazar). */
  recibidas: Amigo[];
  /** Solicitudes que mandé y siguen pendientes (las puedo cancelar). */
  enviadas: Amigo[];
};

/** Amigos y solicitudes del usuario actual, ordenados por nombre. */
export const obtenerAmistades = cache(async (): Promise<Amistades> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const yo = claims?.claims.sub;
  const resultado: Amistades = { amigos: [], recibidas: [], enviadas: [] };
  if (!yo) return resultado;

  const { data, error } = await supabase.from("amistades").select(
    `estado, creado_en, aceptada_en,
       solicitante:perfiles!amistades_solicitante_id_fkey(id, nombre),
       destinatario:perfiles!amistades_destinatario_id_fkey(id, nombre)`,
  );
  if (error) throw error;

  for (const fila of data) {
    const mia = fila.solicitante.id === yo;
    const otro = mia ? fila.destinatario : fila.solicitante;
    const amigo = { id: otro.id, nombre: otro.nombre, desde: fila.aceptada_en ?? fila.creado_en };
    if (fila.estado === "aceptada") resultado.amigos.push(amigo);
    else (mia ? resultado.enviadas : resultado.recibidas).push(amigo);
  }
  const porNombre = (a: Amigo, b: Amigo) => a.nombre.localeCompare(b.nombre, "es");
  resultado.amigos.sort(porNombre);
  resultado.recibidas.sort(porNombre);
  resultado.enviadas.sort(porNombre);
  return resultado;
});
