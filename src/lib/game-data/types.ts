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
  | "es_expansion"
  | "expande"
  | "jugadores_mejor"
  | "jugadores_recomendados"
  | "nombres_alternativos"
  | "imagen_es"
>;

/** Un jugador de una partida registrada en BGG. */
export type JugadorBgg = {
  nombre: string;
  /** Usuario de BGG, si lo cargaron (sirve para reconocer a los amigos). */
  usuario_bgg: string | null;
  puntos: number | null;
  gano: boolean;
};

/** Una partida registrada en BGG ("plays"). */
export type PartidaBgg = {
  bgg_play_id: number;
  /** Día en que se jugó (AAAA-MM-DD). */
  fecha: string;
  minutos: number | null;
  bgg_id: number;
  nombre: string;
  jugadores: JugadorBgg[];
};

/** Un juego de la colección de un usuario de BGG (los que marcó como "Own"). */
export type ItemColeccion = {
  bgg_id: number;
  nombre: string;
  anio: number | null;
  es_expansion: boolean;
  /** La puntuación que le puso en BGG, redondeada a 1–10 (null si no puntuó). */
  puntuacion: number | null;
};

export interface GameDataProvider {
  readonly id: ProviderId;
  /** Busca por nombre. Devuelve [] si la consulta es muy corta. */
  buscar(nombre: string): Promise<ResultadoBusqueda[]>;
  /** Detalle por id del provider; null si no existe. */
  obtenerDetalle(id: string): Promise<DatosJuego | null>;
  /** Detalles de varios juegos por bgg_id (los que no existen no vienen). */
  obtenerDetalles(bggIds: number[]): Promise<DatosJuego[]>;
  /** Juegos y expansiones que un usuario de BGG tiene ("Own"). */
  coleccion(usuario: string): Promise<ItemColeccion[]>;
  /** Partidas que un usuario registró en BGG, de a 100 por página (desde 1). */
  partidas(usuario: string, pagina: number): Promise<{ total: number; partidas: PartidaBgg[] }>;
}

/** Error de un provider con un código estable y un mensaje para la UI. */
export class ErrorGameData extends Error {
  constructor(
    readonly codigo:
      | "no_autorizado"
      | "limite_de_pedidos"
      | "no_disponible"
      | "respuesta_invalida"
      | "usuario_inexistente",
    message: string,
  ) {
    super(message);
    this.name = "ErrorGameData";
  }
}

export const LARGO_MINIMO_BUSQUEDA = 2;
export const MAXIMO_RESULTADOS = 20;
