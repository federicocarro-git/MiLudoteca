import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { agruparPorJuego, type JuegoConDuenos } from "./juegos";

/** Juegos de tus amigos que muestran su catálogo, agrupados. Lee cookies. */
export const obtenerJuegosDeAmigos = cache(async (): Promise<JuegoConDuenos[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogo_de_amigos");
  if (error) throw error;
  return agruparPorJuego(data);
});
