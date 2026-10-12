"use server";

import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/juegos/consultas";
import type { Resultado } from "@/lib/resultado";
import { createClient } from "@/lib/supabase/server";
import { resumenSchema, seccionDesdeUrl } from "@/lib/validations/resumen";

export type EstadoGuardarResumen = Extract<Resultado, { ok: false }> | null;

/**
 * Guarda (crea o actualiza) el resumen del usuario para un juego y vuelve a
 * la pestaña que se estaba editando. RLS exige que el juego sea visible.
 */
export async function guardarResumen(
  juegoId: string,
  _previo: EstadoGuardarResumen,
  formData: FormData,
): Promise<EstadoGuardarResumen> {
  const parseo = resumenSchema.safeParse({
    como_se_juega: formData.get("como_se_juega") ?? "",
    hoja_de_turno: formData.get("hoja_de_turno") ?? "",
  });
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Revisá el texto." };
  }
  const usuario = await getUsuarioActual();
  if (!usuario)
    return {
      ok: false,
      error: "Tu sesión venció. Volvé a ingresar (tu borrador queda guardado en este dispositivo).",
    };
  if (!esUuid(juegoId)) return { ok: false, error: "Ese juego no existe." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("resumenes")
    .upsert(
      { juego_id: juegoId, autor_id: usuario.id, ...parseo.data },
      { onConflict: "juego_id,autor_id" },
    );
  if (error) {
    console.error("No se pudo guardar el resumen", error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }

  redirect(`/juegos/${juegoId}/${seccionDesdeUrl(formData.get("volver_a"))}?guardado=1`);
}
