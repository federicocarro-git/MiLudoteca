"use server";

import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import {
  ErrorGameData,
  getGameDataProvider,
  type DatosJuego,
  type ResultadoBusqueda,
} from "@/lib/game-data";
import { escaparLike, mismosDatos } from "@/lib/juegos/comparar";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import {
  datosDesdeFormData,
  erroresPorCampo,
  juegoFormularioSchema,
  type CampoJuego,
} from "@/lib/validations/juego";

const SESION_VENCIDA = "Tu sesión venció. Volvé a ingresar.";

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorGameData) return error.message;
  console.error(error);
  return "No se pudo completar la búsqueda. Probá de nuevo.";
}

export async function buscarJuegos(consulta: string): Promise<Resultado<ResultadoBusqueda[]>> {
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };
  const provider = getGameDataProvider();
  if (!provider) return { ok: false, error: "La búsqueda no está disponible." };
  try {
    return { ok: true, data: await provider.buscar(String(consulta).slice(0, 100)) };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

export async function obtenerDatosJuego(id: string): Promise<Resultado<DatosJuego>> {
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };
  const provider = getGameDataProvider();
  if (!provider) return { ok: false, error: "La búsqueda no está disponible." };
  try {
    const datos = await provider.obtenerDetalle(String(id));
    return datos ? { ok: true, data: datos } : { ok: false, error: "No encontramos ese juego." };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

export type EstadoGuardarJuego = {
  ok: false;
  error: string;
  errores?: Partial<Record<CampoJuego, string>>;
  duplicado?: { id: string; nombre: string };
} | null;

const COLUMNAS_DATOS =
  "id, bgg_id, nombre, imagen_url, jugadores_min, jugadores_max, duracion_min, complejidad, anio, descripcion, tipos";

export async function guardarJuego(
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
  const supabase = await createClient();
  const { puntuacion, notas, confirmar_duplicado, ...datos } = parseo.data;

  // 1. Si los datos son los de BGG sin cambios, se reusa la fila compartida.
  let juegoId: string | null = null;
  if (datos.bgg_id) {
    const { data: cacheado } = await supabase
      .from("juegos")
      .select(COLUMNAS_DATOS)
      .eq("origen", "bgg")
      .eq("bgg_id", datos.bgg_id)
      .maybeSingle();
    if (cacheado && mismosDatos(cacheado, datos)) juegoId = cacheado.id;
  }

  // 2. Avisar si ya hay un juego igual en el catálogo.
  if (!confirmar_duplicado) {
    const duplicado = await buscarDuplicado(supabase, datos.bgg_id, datos.nombre);
    if (duplicado) {
      return {
        ok: false,
        error: `Ya tenés "${duplicado.nombre}" en tu estante.`,
        duplicado,
      };
    }
  }

  // 3. Si no, se crea un juego manual (privado de este usuario).
  let creado = false;
  if (!juegoId) {
    const { data, error } = await supabase
      .from("juegos")
      .insert({ ...datos, origen: "manual", creado_por: usuario.id })
      .select("id")
      .single();
    if (error) {
      console.error("No se pudo crear el juego", error);
      return { ok: false, error: "No se pudo guardar el juego. Probá de nuevo." };
    }
    juegoId = data.id;
    creado = true;
  }

  // 4. Agregarlo al catálogo.
  const { error } = await supabase
    .from("catalogo_usuario")
    .insert({ juego_id: juegoId, user_id: usuario.id, puntuacion, notas });
  if (error) {
    if (creado) await supabase.from("juegos").delete().eq("id", juegoId);
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ese juego ya está en tu estante.",
        duplicado: { id: juegoId, nombre: datos.nombre },
      };
    }
    console.error("No se pudo agregar al catálogo", error);
    return { ok: false, error: "No se pudo agregar a tu estante. Probá de nuevo." };
  }

  redirect(`/juegos/${juegoId}?agregado=1`);
}

async function buscarDuplicado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bggId: number | null,
  nombre: string,
): Promise<{ id: string; nombre: string } | null> {
  if (bggId) {
    const { data } = await supabase
      .from("mi_catalogo")
      .select("id, nombre")
      .eq("bgg_id", bggId)
      .limit(1)
      .maybeSingle();
    if (data?.id && data.nombre) return { id: data.id, nombre: data.nombre };
  }
  const { data } = await supabase
    .from("mi_catalogo")
    .select("id, nombre")
    .ilike("nombre", escaparLike(nombre.trim()))
    .limit(1)
    .maybeSingle();
  return data?.id && data.nombre ? { id: data.id, nombre: data.nombre } : null;
}
