"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSesionActual, getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import { borrarFotosDePartida } from "@/lib/partidas/borrar-fotos";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { terminarPartidaSchema, type TerminarPartida } from "@/lib/validations/partidas";
import { codigoSalaSchema, nombreJugadorSchema, puntosSchema } from "@/lib/validations/salas";

const SESION_VENCIDA = "Tu sesión venció. Volvé a abrir la sala.";
const SALA_CERRADA = "Esta sala ya no está en curso.";

export type EstadoNombreJugador = (Resultado<null> & { errores?: { nombre?: string } }) | null;

function mensajeDeError(error: PostgrestError, porDefecto: string) {
  if (error.hint === "sala_llena") return "La sala está llena: son 20 jugadores como máximo.";
  return porDefecto;
}

function validarNombre(formData: FormData): EstadoNombreJugador | string {
  const parseo = nombreJugadorSchema.safeParse(formData.get("nombre") ?? "");
  if (parseo.success) return parseo.data;
  const error = parseo.error.issues[0].message;
  return { ok: false, error, errores: { nombre: error } };
}

/**
 * Entrar a una sala sin cuenta: inicia una sesión anónima (si no hay una) y
 * se une con el nombre que escribió. El nombre queda solo en esta partida.
 */
export async function entrarComoInvitado(
  codigo: string,
  _previo: EstadoNombreJugador,
  formData: FormData,
): Promise<EstadoNombreJugador> {
  const nombre = validarNombre(formData);
  if (typeof nombre !== "string") return nombre;
  const parseo = codigoSalaSchema.safeParse(codigo);
  if (!parseo.success) return { ok: false, error: SALA_CERRADA };

  const supabase = await createClient();
  if (!(await getSesionActual())) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("entrarComoInvitado: signInAnonymously", error);
      return {
        ok: false,
        error:
          error.status === 429
            ? "Entraron demasiados invitados desde esta red. Probá en un rato o ingresá con tu cuenta."
            : "No se pudo entrar como invitado. Probá de nuevo.",
      };
    }
  }

  const { data, error } = await supabase.rpc("unirse_a_partida", { codigo: parseo.data, nombre });
  if (error) {
    console.error("entrarComoInvitado", parseo.data, error);
    return {
      ok: false,
      error: mensajeDeError(error, "No se pudo entrar a la sala. Probá de nuevo."),
    };
  }
  if (!data) return { ok: false, error: SALA_CERRADA };
  redirect(`/sala/${parseo.data}`);
}

/** Unirse con la cuenta (entra con el nombre del perfil). */
export async function unirmeConMiCuenta(codigo: string): Promise<Resultado<null>> {
  const parseo = codigoSalaSchema.safeParse(codigo);
  if (!parseo.success) return { ok: false, error: SALA_CERRADA };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unirse_a_partida", { codigo: parseo.data });
  if (error) {
    console.error("unirmeConMiCuenta", parseo.data, error);
    return {
      ok: false,
      error: mensajeDeError(error, "No se pudo entrar a la sala. Probá de nuevo."),
    };
  }
  if (!data) return { ok: false, error: SALA_CERRADA };
  refresh();
  return { ok: true, data: null };
}

/** Puntos de un jugador: los propios o, el anfitrión, los de cualquiera (RLS). */
export async function actualizarPuntos(
  jugadorId: string,
  puntos: number,
): Promise<Resultado<null>> {
  const parseo = puntosSchema.safeParse(puntos);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };
  if (!esUuid(jugadorId)) return { ok: false, error: "Ese jugador no está en la sala." };
  if (!(await getSesionActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partida_jugadores")
    .update({ puntos: parseo.data })
    .eq("id", jugadorId)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("actualizarPuntos", jugadorId, error);
    return { ok: false, error: "No se pudieron guardar los puntos." };
  }
  return { ok: true, data: null };
}

/** El anfitrión suma amigos a la sala. */
export async function agregarAmigosASala(
  partidaId: string,
  amigos: string[],
): Promise<Resultado<null>> {
  if (!esUuid(partidaId) || amigos.length === 0 || !amigos.every(esUuid)) {
    return { ok: false, error: "Elegí a quién agregar." };
  }
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  // El nombre lo pone el trigger a partir del perfil.
  const { error } = await supabase
    .from("partida_jugadores")
    .insert(amigos.map((user_id) => ({ partida_id: partidaId, user_id, nombre: "amigo" })));
  if (error) {
    console.error("agregarAmigosASala", partidaId, error);
    return {
      ok: false,
      error: mensajeDeError(
        error,
        error.code === "23505"
          ? "Alguno ya estaba en la sala."
          : "No se pudo agregar. Probá de nuevo.",
      ),
    };
  }
  refresh();
  return { ok: true, data: null };
}

/** El anfitrión suma a alguien que juega sin celular (le carga los puntos). */
export async function agregarSinCelular(
  partidaId: string,
  _previo: EstadoNombreJugador,
  formData: FormData,
): Promise<EstadoNombreJugador> {
  const nombre = validarNombre(formData);
  if (typeof nombre !== "string") return nombre;
  if (!esUuid(partidaId)) return { ok: false, error: SALA_CERRADA };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { error } = await supabase
    .from("partida_jugadores")
    .insert({ partida_id: partidaId, nombre });
  if (error) {
    console.error("agregarSinCelular", partidaId, error);
    return { ok: false, error: mensajeDeError(error, "No se pudo agregar. Probá de nuevo.") };
  }
  refresh();
  return { ok: true, data: null };
}

/** El anfitrión saca a un jugador. */
export async function quitarJugador(jugadorId: string): Promise<Resultado<null>> {
  if (!esUuid(jugadorId)) return { ok: false, error: "Ese jugador no está en la sala." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partida_jugadores")
    .delete()
    .eq("id", jugadorId)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("quitarJugador", jugadorId, error);
    return { ok: false, error: "No se pudo sacar al jugador." };
  }
  refresh();
  return { ok: true, data: null };
}

/** Irse de la sala (el anfitrión no puede: la cancela). */
export async function salirDeSala(partidaId: string, codigo: string): Promise<Resultado<null>> {
  const sesion = await getSesionActual();
  if (!sesion) return { ok: false, error: SESION_VENCIDA };
  if (!esUuid(partidaId)) return { ok: false, error: SALA_CERRADA };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partida_jugadores")
    .delete()
    .eq("partida_id", partidaId)
    .eq("user_id", sesion.id)
    .select("id");
  if (error || data.length === 0) {
    if (error) console.error("salirDeSala", partidaId, error);
    return { ok: false, error: "No se pudo salir de la sala." };
  }
  // Un invitado vuelve a la pantalla de la sala (por si quiere volver a entrar).
  redirect(sesion.anonimo ? `/sala/${codigoSalaSchema.catch("").parse(codigo)}` : "/jugar");
}

/** El anfitrión cancela la sala: se borra con sus jugadores y puntos. */
export async function cancelarSala(partidaId: string): Promise<Resultado<null>> {
  if (!esUuid(partidaId)) return { ok: false, error: SALA_CERRADA };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  await borrarFotosDePartida(supabase, partidaId);
  const { data, error } = await supabase.from("partidas").delete().eq("id", partidaId).select("id");
  if (error || data.length === 0) {
    if (error) console.error("cancelarSala", partidaId, error);
    return { ok: false, error: "No se pudo cancelar la sala." };
  }
  redirect("/jugar");
}

/** El anfitrión termina la partida y queda decidido quién ganó. */
export async function terminarPartida(
  partidaId: string,
  datos: TerminarPartida,
): Promise<Resultado<null>> {
  const parseo = terminarPartidaSchema.safeParse(datos);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };
  if (!esUuid(partidaId)) return { ok: false, error: SALA_CERRADA };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { modo, ganadores, ganamos } = parseo.data;
  const { error } = await supabase.rpc("terminar_partida", {
    partida: partidaId,
    modo,
    ganadores,
    ...(ganamos === null ? {} : { ganamos }),
  });
  if (error) {
    console.error("terminarPartida", partidaId, error);
    return { ok: false, error: "No se pudo terminar la partida. Probá de nuevo." };
  }
  redirect(`/partida/${partidaId}`);
}

/** El anfitrión cambia el juego de la sala por uno de la mesa. */
export async function cambiarJuegoDeSala(
  partidaId: string,
  juegoId: string,
): Promise<Resultado<null>> {
  if (!esUuid(partidaId) || !esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };
  if (!(await getUsuarioActual())) return { ok: false, error: SESION_VENCIDA };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_juego_de_sala", {
    partida: partidaId,
    juego: juegoId,
  });
  if (error) {
    console.error("cambiarJuegoDeSala", partidaId, juegoId, error);
    return { ok: false, error: "No se pudo cambiar el juego. Probá de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}
