import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatosJuego } from "../types";
import type { CacheJuegosBgg } from "./bgg-provider";

const COLUMNAS =
  "bgg_id, nombre, imagen_url, jugadores_min, jugadores_max, duracion_min, complejidad, anio, descripcion, tipos, bgg_sincronizado_en";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Cache de BGG en la tabla `juegos` (filas `origen = 'bgg'`). Escribe con el
 * cliente admin: los usuarios no pueden escribir filas de BGG (RLS).
 */
export class CacheSupabase implements CacheJuegosBgg {
  constructor(private readonly admin: Admin = createAdminClient()) {}

  async obtener(bggId: number) {
    const { data, error } = await this.admin
      .from("juegos")
      .select(COLUMNAS)
      .eq("origen", "bgg")
      .eq("bgg_id", bggId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.bgg_sincronizado_en) return null;
    const { bgg_sincronizado_en, ...datos } = data;
    return { datos, sincronizadoEn: new Date(bgg_sincronizado_en) };
  }

  async guardar(datos: DatosJuego, sincronizadoEn: Date) {
    const fila = { ...datos, origen: "bgg", bgg_sincronizado_en: sincronizadoEn.toISOString() };
    // El índice único de bgg_id es parcial (solo filas 'bgg') y PostgREST no
    // puede hacer upsert contra un índice parcial: primero se intenta
    // actualizar y, si no había fila, se inserta.
    const actualizada = await this.actualizar(fila);
    if (actualizada) return;
    const { error } = await this.admin.from("juegos").insert(fila);
    // 23505: otro pedido la insertó al mismo tiempo; se actualiza esa.
    if (error?.code === "23505") {
      await this.actualizar(fila);
      return;
    }
    if (error) throw error;
  }

  private async actualizar(fila: DatosJuego & { origen: string; bgg_sincronizado_en: string }) {
    const { data, error } = await this.admin
      .from("juegos")
      .update(fila)
      .eq("origen", "bgg")
      .eq("bgg_id", fila.bgg_id!)
      .select("id");
    if (error) throw error;
    return data.length > 0;
  }
}
