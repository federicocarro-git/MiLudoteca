"use server";

import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { codigoSalaSchema } from "@/lib/validations/salas";

/**
 * Crea una sala y lleva a ella. Sin juego ("Elegimos en la mesa"), se elige
 * después entre los catálogos de todos los que se sumen.
 */
export async function crearSala(juegoId: string | null): Promise<Resultado<null>> {
  if (juegoId !== null && !esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };
  if (!(await getUsuarioActual()))
    return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  const supabase = await createClient();
  const { data, error } = juegoId
    ? await supabase.rpc("crear_partida", { juego: juegoId })
    : await supabase.rpc("crear_sala_sin_juego");
  const sala = data?.[0];
  if (error || !sala) {
    console.error("crearSala", juegoId, error);
    return { ok: false, error: "No se pudo crear la sala. Probá de nuevo." };
  }
  redirect(`/sala/${sala.codigo}`);
}

export type EstadoIrASala = (Resultado<null> & { errores?: { codigo?: string } }) | null;

/** "Unirse con un código": valida que la sala exista y lleva a ella. */
export async function irASala(_previo: EstadoIrASala, formData: FormData): Promise<EstadoIrASala> {
  const parseo = codigoSalaSchema.safeParse(formData.get("codigo") ?? "");
  if (!parseo.success) {
    const error = parseo.error.issues[0].message;
    return { ok: false, error, errores: { codigo: error } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ver_sala", { codigo: parseo.data });
  if (error) {
    console.error("irASala", parseo.data, error);
    return { ok: false, error: "No se pudo buscar la sala. Probá de nuevo." };
  }
  if (data.length === 0) {
    const mensaje = "No hay ninguna sala en curso con ese código.";
    return { ok: false, error: mensaje, errores: { codigo: mensaje } };
  }
  redirect(`/sala/${parseo.data}`);
}
