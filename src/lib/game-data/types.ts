import type { Database } from "@/lib/supabase/database.types";

type JuegoRow = Database["public"]["Tables"]["juegos"]["Row"];

export type ProviderId = "bgg" | "mock";

/** Un resultado de búsqueda: lo mínimo para mostrar en la lista. */
export type ResultadoBusqueda = {
  /** Id dentro del provider (en BGG, el bgg_id como texto). */
  id: string;
  nombre: string;
  anio: number | null;
};

/**
 * Datos completos de un juego tal como los devuelve un provider. Usa los
 * nombres de las columnas de `juegos` para poder precargar el formulario y
 * guardar sin mapeos.
 */
export type DatosJuego = Pick<
  JuegoRow,
  | "bgg_id"
  | "nombre"
  | "imagen_url"
  | "jugadores_min"
  | "jugadores_max"
  | "duracion_min"
  | "complejidad"
  | "anio"
  | "descripcion"
  | "tipos"
>;

export interface GameDataProvider {
  readonly id: ProviderId;
  /** Busca por nombre. Devuelve [] si la consulta es muy corta. */
  buscar(nombre: string): Promise<ResultadoBusqueda[]>;
  /** Detalle por id del provider; null si no existe. */
  obtenerDetalle(id: string): Promise<DatosJuego | null>;
}

/** Error de un provider con un código estable y un mensaje para la UI. */
export class ErrorGameData extends Error {
  constructor(
    readonly codigo: "no_autorizado" | "limite_de_pedidos" | "no_disponible" | "respuesta_invalida",
    message: string,
  ) {
    super(message);
    this.name = "ErrorGameData";
  }
}

export const LARGO_MINIMO_BUSQUEDA = 2;
export const MAXIMO_RESULTADOS = 20;
