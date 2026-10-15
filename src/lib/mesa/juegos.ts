import { normalizar } from "@/lib/game-data/texto";

// Juegos de otros (amigos o la mesa de una sala), como los devuelven
// catalogo_de_amigos() y juegos_de_la_mesa(): una fila por juego y dueño.

export type FilaJuegoAjeno = {
  dueno_id: string;
  dueno_nombre: string;
  juego_id: string;
  bgg_id: number | null;
  nombre: string;
  imagen_url: string | null;
  jugadores_min: number | null;
  jugadores_max: number | null;
  duracion_min: number | null;
  complejidad: number | null;
  tipos: string[];
};

export type JuegoConDuenos = Omit<FilaJuegoAjeno, "dueno_id" | "dueno_nombre"> & {
  /** Para juntar el mismo juego de distintos dueños: el id de BGG o el nombre. */
  clave: string;
  duenos: { id: string; nombre: string }[];
};

/** El mismo juego en dos catálogos: mismo id de BGG o, si no tiene, mismo nombre. */
export function claveDeJuego(juego: { bgg_id: number | null; nombre: string }) {
  return juego.bgg_id ? `bgg:${juego.bgg_id}` : `nombre:${normalizar(juego.nombre.trim())}`;
}

/**
 * Junta las filas por juego, con sus dueños, ordenado por nombre. Si el mismo
 * juego está cargado distinto en cada catálogo, se queda con el nombre más
 * repetido (en un empate, el que tiene mayúsculas: "Catan" antes que
 * "catan") y completa los datos que le falten con los de las otras copias.
 */
export function agruparPorJuego(filas: FilaJuegoAjeno[]): JuegoConDuenos[] {
  const juegos = new Map<string, JuegoConDuenos & { nombres: Map<string, number> }>();
  for (const { dueno_id, dueno_nombre, ...juego } of filas) {
    const clave = claveDeJuego(juego);
    const actual = juegos.get(clave);
    if (!actual) {
      juegos.set(clave, {
        ...juego,
        clave,
        duenos: [{ id: dueno_id, nombre: dueno_nombre }],
        nombres: new Map([[juego.nombre, 1]]),
      });
      continue;
    }
    if (!actual.duenos.some((d) => d.id === dueno_id)) {
      actual.duenos.push({ id: dueno_id, nombre: dueno_nombre });
    }
    actual.nombres.set(juego.nombre, (actual.nombres.get(juego.nombre) ?? 0) + 1);
    actual.imagen_url ??= juego.imagen_url;
    actual.jugadores_min ??= juego.jugadores_min;
    actual.jugadores_max ??= juego.jugadores_max;
    actual.duracion_min ??= juego.duracion_min;
    actual.complejidad ??= juego.complejidad;
    if (actual.tipos.length === 0) actual.tipos = juego.tipos;
  }
  const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
  const mayusculas = (t: string) => (t.match(/\p{Lu}/gu) ?? []).length;
  return [...juegos.values()]
    .map(({ nombres, ...j }) => {
      const [nombre] = [...nombres].sort(
        ([a, na], [b, nb]) => nb - na || mayusculas(b) - mayusculas(a) || a.localeCompare(b),
      )[0];
      return { ...j, nombre, duenos: j.duenos.sort(porNombre) };
    })
    .sort(porNombre);
}

/**
 * Juegos para esta cantidad de jugadores (y, si se pide, que duren a lo sumo
 * tanto). Como en el catálogo, un juego sin el dato no pasa: no sabemos si sirve.
 */
export function juegosParaLaMesa<
  T extends Pick<FilaJuegoAjeno, "jugadores_min" | "jugadores_max" | "duracion_min">,
>(juegos: T[], jugadores: number, duracionMaxima: number | null = null): T[] {
  return juegos.filter(
    (j) =>
      j.jugadores_min !== null &&
      j.jugadores_max !== null &&
      j.jugadores_min <= jugadores &&
      j.jugadores_max >= jugadores &&
      (duracionMaxima === null || (j.duracion_min !== null && j.duracion_min <= duracionMaxima)),
  );
}

/** Filtro de "¿Quién lo tiene?": por nombre (sin tildes) y por amigo. */
export function filtrarJuegosDeAmigos(
  juegos: JuegoConDuenos[],
  filtros: { q?: string; amigo?: string | null },
): JuegoConDuenos[] {
  const q = filtros.q ? normalizar(filtros.q.trim()) : "";
  return juegos.filter(
    (j) =>
      (!q || normalizar(j.nombre).includes(q)) &&
      (!filtros.amigo || j.duenos.some((d) => d.id === filtros.amigo)),
  );
}
