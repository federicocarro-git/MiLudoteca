import type { Database } from "@/lib/supabase/database.types";

type Tablas = Database["public"]["Tables"];

export type Sala = Pick<
  Tablas["partidas"]["Row"],
  | "id"
  | "codigo"
  | "juego_id"
  | "juego_nombre"
  | "juego_imagen_url"
  | "anfitrion_id"
  | "estado"
  | "creada_en"
  | "tipo_puntaje"
  | "rondas"
  | "categorias"
>;

/** Lo que se muestra en lugar del juego mientras la sala no tiene uno. */
export const SIN_JUEGO = "Sin juego todavía";

export type TipoPuntaje = "total" | "rondas" | "categorias";

/** Cómo se anota en la sala (cambia con configurar_puntaje y agregar_ronda). */
export type ConfigPuntaje = { tipo_puntaje: string; rondas: number; categorias: string[] };

/** Un casillero de la hoja (ronda o categoría) de un jugador. */
export type Anotacion = { jugador_id: string; columna: number; puntos: number };

export const COLUMNAS_ANOTACION = "jugador_id, columna, puntos";

export type JugadorSala = Pick<
  Tablas["partida_jugadores"]["Row"],
  "id" | "user_id" | "nombre" | "invitado" | "puntos" | "unido_en"
>;

/** Columnas que se piden de partida_jugadores (servidor y Realtime). */
export const COLUMNAS_JUGADOR = "id, user_id, nombre, invitado, puntos, unido_en";

/** Ids de quienes van ganando (puede haber empate). Nadie si todos tienen 0. */
export function puntajeMasAlto(jugadores: Pick<JugadorSala, "id" | "puntos">[]): Set<string> {
  if (jugadores.length < 2) return new Set();
  const maximo = Math.max(...jugadores.map((j) => j.puntos));
  if (jugadores.every((j) => j.puntos === maximo)) return new Set();
  return new Set(jugadores.filter((j) => j.puntos === maximo).map((j) => j.id));
}

/**
 * Puntos tocados en este celular que el servidor todavía no confirmó.
 * `guardadoEn`: cuándo terminó de guardarse (null mientras no se guardó).
 */
export type Pendiente<T = number> = { puntos: T; guardadoEn: number | null };

/**
 * Suelta los pendientes que ya están incluidos en una recarga: los que se
 * guardaron antes de que empezara ese pedido. Los demás siguen mandando
 * (una respuesta pedida antes de guardar traería el valor viejo).
 */
export function soltarConfirmados<P extends { guardadoEn: number | null }>(
  pendientes: Record<string, P>,
  inicioRecarga: number,
): Record<string, P> {
  const quedan = Object.entries(pendientes).filter(
    ([, p]) => p.guardadoEn === null || p.guardadoEn > inicioRecarga,
  );
  return quedan.length === Object.keys(pendientes).length ? pendientes : Object.fromEntries(quedan);
}

// -----------------------------------------------------------------------------
// Hoja por rondas o por categorías
// -----------------------------------------------------------------------------

/** Nombres de las filas de la hoja: "Ronda 1", "Ronda 2"... o las categorías. */
export function filasDeLaHoja(config: ConfigPuntaje): string[] {
  if (config.tipo_puntaje === "rondas") {
    return Array.from({ length: config.rondas }, (_, i) => `Ronda ${i + 1}`);
  }
  if (config.tipo_puntaje === "categorias") return config.categorias;
  return [];
}

export const claveCasillero = (jugadorId: string, columna: number) => `${jugadorId}:${columna}`;

/**
 * Casilleros a mostrar: lo que vino del servidor con los cambios sin
 * confirmar encima (null = casillero borrado). Clave: claveCasillero().
 */
export function casillerosVisibles(
  anotaciones: Anotacion[],
  pendientes: Record<string, Pendiente<number | null>>,
): Map<string, number> {
  const casilleros = new Map(
    anotaciones.map((a) => [claveCasillero(a.jugador_id, a.columna), a.puntos]),
  );
  for (const [clave, { puntos }] of Object.entries(pendientes)) {
    if (puntos === null) casilleros.delete(clave);
    else casilleros.set(clave, puntos);
  }
  return casilleros;
}

/** Total de cada jugador sumando sus casilleros visibles. */
export function totalesDeLaHoja(
  jugadores: Pick<JugadorSala, "id">[],
  casilleros: Map<string, number>,
): Map<string, number> {
  const totales = new Map(jugadores.map((j) => [j.id, 0]));
  for (const [clave, puntos] of casilleros) {
    const jugadorId = clave.slice(0, clave.lastIndexOf(":"));
    if (totales.has(jugadorId)) totales.set(jugadorId, totales.get(jugadorId)! + puntos);
  }
  return totales;
}

/**
 * Categorías escritas una por línea (o separadas por comas): sin vacías ni
 * repetidas, hasta 20 y de hasta 30 caracteres.
 */
export function leerCategorias(texto: string): string[] {
  const vistas = new Set<string>();
  return texto
    .split(/[\n,]/)
    .map((c) => c.trim().slice(0, 30))
    .filter((c) => {
      const clave = c.toLocaleLowerCase("es");
      if (!c || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    })
    .slice(0, 20);
}
