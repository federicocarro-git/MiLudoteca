// Quién gana una partida y cómo se cuenta. Es la misma regla que aplica
// public.terminar_partida() en la base; acá sirve para mostrar el resultado
// antes de confirmar y para los textos del historial.

export const MODOS_RESULTADO = ["mas_puntos", "menos_puntos", "manual", "cooperativo"] as const;
export type ModoResultado = (typeof MODOS_RESULTADO)[number];

export const NOMBRE_MODO: Record<ModoResultado, string> = {
  mas_puntos: "Gana el que más puntos tiene",
  menos_puntos: "Gana el que menos puntos tiene",
  manual: "Elegir a los ganadores",
  cooperativo: "Cooperativo: todos juntos",
};

type ConPuntos = { id: string; puntos: number };

/** Ganadores según el modo. Empatados en el primer puesto: ganan todos. */
export function ganadoresPrevistos(
  jugadores: ConPuntos[],
  modo: ModoResultado,
  opciones: { elegidos?: string[]; ganamos?: boolean | null } = {},
): Set<string> {
  if (modo === "cooperativo") {
    return new Set(opciones.ganamos ? jugadores.map((j) => j.id) : []);
  }
  if (modo === "manual") {
    const elegidos = new Set(opciones.elegidos ?? []);
    return new Set(jugadores.filter((j) => elegidos.has(j.id)).map((j) => j.id));
  }
  if (jugadores.length === 0) return new Set();
  const puntos = jugadores.map((j) => j.puntos);
  const mejor = modo === "menos_puntos" ? Math.min(...puntos) : Math.max(...puntos);
  return new Set(jugadores.filter((j) => j.puntos === mejor).map((j) => j.id));
}

/** Une nombres: "Ana", "Ana y Beto", "Ana, Beto y Caro". */
export function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

type PartidaResultado = {
  modo_resultado: string | null;
  cooperativo_ganado: boolean | null;
  jugadores: { nombre: string; gano: boolean }[];
};

/** "Ganó Ana", "Ganaron Beto y Caro", "Ganaron todos", "Perdieron todos", "Nadie ganó". */
export function textoResultado(partida: PartidaResultado): string {
  if (partida.modo_resultado === "cooperativo") {
    return partida.cooperativo_ganado ? "Ganaron todos" : "Perdieron todos";
  }
  const ganadores = partida.jugadores.filter((j) => j.gano).map((j) => j.nombre);
  if (ganadores.length === 0) return "Nadie ganó";
  if (ganadores.length === partida.jugadores.length && ganadores.length > 1) return "Empate";
  return `${ganadores.length === 1 ? "Ganó" : "Ganaron"} ${unirNombres(ganadores)}`;
}

/** Minutos entre el inicio y el fin (al menos 1). */
export function minutosDePartida(creada: string, terminada: string | null): number | null {
  if (!terminada) return null;
  const ms = new Date(terminada).getTime() - new Date(creada).getTime();
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 60_000)) : null;
}

/** Fecha corta en español: "15 de octubre de 2026". */
export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Minutos durante los que el anfitrión puede reabrir una partida terminada (igual que la base). */
export const MINUTOS_PARA_REABRIR = 10;

/** Milisegundos que quedan para reabrir la partida (0 si ya no se puede). */
export function tiempoParaReabrir(terminada: string | null, ahora: number): number {
  if (!terminada) return 0;
  return Math.max(0, Date.parse(terminada) + MINUTOS_PARA_REABRIR * 60_000 - ahora);
}
