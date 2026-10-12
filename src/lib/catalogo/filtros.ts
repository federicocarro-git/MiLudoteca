import { normalizar } from "@/lib/game-data/texto";
import { TIPOS, type Tipo } from "@/lib/game-data/tipos";

// Filtros del catálogo: se leen y escriben en la query string y se aplican en
// el navegador sobre el catálogo completo del usuario (una colección personal
// son a lo sumo unos cientos de juegos).

export type JuegoCatalogo = {
  id: string;
  nombre: string;
  imagen_url: string | null;
  jugadores_min: number | null;
  jugadores_max: number | null;
  duracion_min: number | null;
  complejidad: number | null;
  anio: number | null;
  tipos: string[];
  puntuacion: number | null;
  agregado_en: string;
};

export const NIVELES_COMPLEJIDAD = {
  liviano: { etiqueta: "Liviano", desde: 1, hasta: 2 },
  medio: { etiqueta: "Medio", desde: 2, hasta: 3 },
  pesado: { etiqueta: "Pesado", desde: 3, hasta: 5.01 },
} as const;
export type NivelComplejidad = keyof typeof NIVELES_COMPLEJIDAD;

export const ORDENES = {
  nombre: "Nombre",
  recientes: "Agregados recientemente",
  puntuacion: "Mejor puntuados",
  duracion: "Más cortos primero",
} as const;
export type Orden = keyof typeof ORDENES;

export const OPCIONES_JUGADORES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const OPCIONES_DURACION = [15, 30, 45, 60, 90, 120, 180] as const;

export type Filtros = {
  /** Cantidad de personas que van a jugar. */
  jugadores?: number;
  /** Duración máxima en minutos. */
  duracion?: number;
  complejidad?: NivelComplejidad;
  tipo?: Tipo;
  /** Texto a buscar en el nombre. */
  q?: string;
  orden?: Orden;
};

type Parametros = URLSearchParams | Record<string, string | string[] | undefined>;

function leer(params: Parametros, clave: string): string | undefined {
  const valor = params instanceof URLSearchParams ? params.get(clave) : params[clave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto?.trim() || undefined;
}

function enteroEntre(texto: string | undefined, min: number, max: number) {
  if (!texto || !/^\d+$/.test(texto)) return undefined;
  const n = Number(texto);
  return n >= min && n <= max ? n : undefined;
}

/** Lee los filtros de la URL. Lo inválido se ignora. */
export function leerFiltros(params: Parametros): Filtros {
  const filtros: Filtros = {};
  const jugadores = enteroEntre(leer(params, "jugadores"), 1, 100);
  if (jugadores) filtros.jugadores = jugadores;
  const duracion = enteroEntre(leer(params, "duracion"), 1, 10000);
  if (duracion) filtros.duracion = duracion;
  const complejidad = leer(params, "complejidad");
  if (complejidad && Object.hasOwn(NIVELES_COMPLEJIDAD, complejidad)) {
    filtros.complejidad = complejidad as NivelComplejidad;
  }
  const tipo = leer(params, "tipo");
  if (tipo && (TIPOS as readonly string[]).includes(tipo)) filtros.tipo = tipo as Tipo;
  const q = leer(params, "q");
  if (q) filtros.q = q.slice(0, 100);
  const orden = leer(params, "orden");
  if (orden && orden !== "nombre" && Object.hasOwn(ORDENES, orden)) filtros.orden = orden as Orden;
  return filtros;
}

/** Query string para los filtros (sin "?"), con orden estable de claves. */
export function escribirFiltros(filtros: Filtros): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.jugadores) params.set("jugadores", String(filtros.jugadores));
  if (filtros.duracion) params.set("duracion", String(filtros.duracion));
  if (filtros.complejidad) params.set("complejidad", filtros.complejidad);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.orden && filtros.orden !== "nombre") params.set("orden", filtros.orden);
  return params.toString();
}

/** Cuántos filtros hay activos (sin contar la búsqueda ni el orden). */
export function contarFiltros(filtros: Filtros): number {
  return [filtros.jugadores, filtros.duracion, filtros.complejidad, filtros.tipo].filter(
    (v) => v !== undefined,
  ).length;
}

/**
 * ¿El juego sirve para estos filtros? Si un juego no tiene un dato, no pasa el
 * filtro de ese dato (no sabemos si sirve).
 */
export function cumpleFiltros(juego: JuegoCatalogo, filtros: Filtros): boolean {
  const { jugadores, duracion, complejidad, tipo, q } = filtros;
  if (jugadores !== undefined) {
    if (juego.jugadores_min === null || juego.jugadores_max === null) return false;
    if (juego.jugadores_min > jugadores || juego.jugadores_max < jugadores) return false;
  }
  if (duracion !== undefined && (juego.duracion_min === null || juego.duracion_min > duracion)) {
    return false;
  }
  if (complejidad !== undefined) {
    const { desde, hasta } = NIVELES_COMPLEJIDAD[complejidad];
    if (juego.complejidad === null || juego.complejidad < desde || juego.complejidad >= hasta) {
      return false;
    }
  }
  if (tipo !== undefined && !juego.tipos.includes(tipo)) return false;
  if (q !== undefined && !normalizar(juego.nombre).includes(normalizar(q))) return false;
  return true;
}

const porNombre = (a: JuegoCatalogo, b: JuegoCatalogo) =>
  a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });

/** Nulos al final, sin importar el sentido del orden. */
function compararConNulos(a: number | null, b: number | null, descendente: boolean) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return descendente ? b - a : a - b;
}

const COMPARADORES: Record<Orden, (a: JuegoCatalogo, b: JuegoCatalogo) => number> = {
  nombre: porNombre,
  recientes: (a, b) => b.agregado_en.localeCompare(a.agregado_en) || porNombre(a, b),
  puntuacion: (a, b) => compararConNulos(a.puntuacion, b.puntuacion, true) || porNombre(a, b),
  duracion: (a, b) => compararConNulos(a.duracion_min, b.duracion_min, false) || porNombre(a, b),
};

export function filtrarCatalogo(juegos: JuegoCatalogo[], filtros: Filtros): JuegoCatalogo[] {
  return juegos
    .filter((j) => cumpleFiltros(j, filtros))
    .sort(COMPARADORES[filtros.orden ?? "nombre"]);
}

/** Tipos usados en el catálogo (para no ofrecer filtros que dan vacío). */
export function tiposDelCatalogo(juegos: JuegoCatalogo[]): Tipo[] {
  const usados = new Set(juegos.flatMap((j) => j.tipos));
  return TIPOS.filter((t) => usados.has(t));
}

/**
 * Elige un juego al azar. Si hay más de uno, evita repetir el anterior para
 * que "Otro" siempre cambie.
 */
export function elegirAlAzar<T extends { id: string }>(
  juegos: T[],
  anteriorId?: string,
  azar: () => number = Math.random,
): T | null {
  const candidatos = juegos.length > 1 ? juegos.filter((j) => j.id !== anteriorId) : juegos;
  if (candidatos.length === 0) return null;
  return candidatos[Math.floor(azar() * candidatos.length)];
}
