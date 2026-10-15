// Filtros del historial (funciones puras: se usan en el navegador y se testean).

type Jugador = {
  user_id: string | null;
  nombre: string;
  gano: boolean;
  puntos: number;
  posicion: number | null;
};
export type PartidaDelHistorial = {
  id: string;
  juego_id: string | null;
  juego_nombre: string;
  jugadores: Jugador[];
};

/** Clave para filtrar por juego: el id o, si el juego se borró, el nombre. */
export function claveJuego(p: Pick<PartidaDelHistorial, "juego_id" | "juego_nombre">) {
  return p.juego_id ?? `nombre:${p.juego_nombre}`;
}

export type Opcion = { valor: string; etiqueta: string };

/** Juegos y personas (con cuenta, sin contarme) que aparecen en el historial. */
export function opcionesDeFiltro(partidas: PartidaDelHistorial[], yo: string) {
  const juegos = new Map<string, string>();
  const personas = new Map<string, string>();
  for (const p of partidas) {
    juegos.set(claveJuego(p), p.juego_nombre);
    for (const j of p.jugadores) {
      if (j.user_id && j.user_id !== yo && !personas.has(j.user_id))
        personas.set(j.user_id, j.nombre);
    }
  }
  const ordenar = (m: Map<string, string>): Opcion[] =>
    [...m]
      .map(([valor, etiqueta]) => ({ valor, etiqueta }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  return { juegos: ordenar(juegos), personas: ordenar(personas) };
}

export function filtrarHistorial<T extends PartidaDelHistorial>(
  partidas: T[],
  filtros: { juego?: string | null; con?: string | null },
): T[] {
  return partidas.filter(
    (p) =>
      (!filtros.juego || claveJuego(p) === filtros.juego) &&
      (!filtros.con || p.jugadores.some((j) => j.user_id === filtros.con)),
  );
}

/** Mi fila en la partida (si jugué con cuenta). */
export function miParticipacion(p: PartidaDelHistorial, yo: string) {
  return p.jugadores.find((j) => j.user_id === yo) ?? null;
}
