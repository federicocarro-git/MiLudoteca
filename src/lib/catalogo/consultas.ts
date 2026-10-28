import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JuegoCatalogo } from "./filtros";

/** Catálogo completo del usuario actual (vista mi_catalogo + RLS). Lee cookies. */
export async function obtenerMiCatalogo(): Promise<JuegoCatalogo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mi_catalogo")
    .select(
      "id, bgg_id, es_expansion, expande, nombre, imagen_url, jugadores_min, jugadores_max, duracion_min, complejidad, anio, tipos, puntuacion, agregado_en",
    )
    .order("nombre");
  if (error) throw error;
  // En las vistas, Postgres marca todas las columnas como nullables.
  return data.flatMap((fila) =>
    fila.id && fila.nombre && fila.agregado_en
      ? [
          {
            ...fila,
            id: fila.id,
            nombre: fila.nombre,
            agregado_en: fila.agregado_en,
            tipos: fila.tipos ?? [],
            es_expansion: fila.es_expansion ?? false,
            expande: fila.expande ?? [],
          },
        ]
      : [],
  );
}
