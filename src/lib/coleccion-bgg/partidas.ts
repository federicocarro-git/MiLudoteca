import type { PartidaBgg } from "@/lib/game-data/types";

// Partidas registradas en BGG → lo que recibe importar_partidas_bgg().

/** Partidas por página en `plays` de BGG. */
export const PARTIDAS_POR_PAGINA = 100;

export type PartidaParaImportar = {
  bgg_play_id: number;
  juego_id: string | null;
  juego_nombre: string;
  jugado_en: string;
  minutos: number | null;
  jugadores: { user_id: string | null; nombre: string; puntos: number | null; gano: boolean }[];
};

/**
 * Arma las partidas para la base:
 * - quien importa es el jugador con su usuario de BGG (y si la partida no
 *   tiene jugadores cargados, se lo suma: es su registro);
 * - un amigo es el jugador con el usuario de BGG que ese amigo vinculó;
 * - el resto entra sin cuenta, con su nombre;
 * - el juego se vincula si su fila de BGG ya está en la base (si no, queda
 *   solo el nombre, como una partida de un juego que se borró).
 */
export function armarPartidasParaImportar(
  partidas: PartidaBgg[],
  contexto: {
    yo: { id: string; usuarioBgg: string };
    /** usuario de BGG (en minúsculas) → id del amigo */
    amigos: ReadonlyMap<string, string>;
    /** bgg_id → id de la fila de BGG en `juegos` */
    juegos: ReadonlyMap<number, string>;
  },
): PartidaParaImportar[] {
  const yo = contexto.yo.usuarioBgg.trim().toLowerCase();
  return partidas.map((p) => {
    const jugadores = p.jugadores.map((j) => {
      const usuario = j.usuario_bgg?.trim().toLowerCase() ?? null;
      const userId =
        usuario === yo ? contexto.yo.id : usuario ? (contexto.amigos.get(usuario) ?? null) : null;
      return { user_id: userId, nombre: j.nombre, puntos: j.puntos, gano: j.gano };
    });
    if (jugadores.length === 0) {
      jugadores.push({ user_id: contexto.yo.id, nombre: "Yo", puntos: null, gano: false });
    }
    return {
      bgg_play_id: p.bgg_play_id,
      juego_id: contexto.juegos.get(p.bgg_id) ?? null,
      juego_nombre: p.nombre,
      jugado_en: p.fecha,
      minutos: p.minutos,
      jugadores,
    };
  });
}
