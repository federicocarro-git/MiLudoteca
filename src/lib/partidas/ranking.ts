// Ranking y cara a cara entre amigos (funciones puras, testeadas).
//
// Se calculan con el historial del usuario: las partidas terminadas en las
// que jugó (es lo que RLS deja ver). Solo cuentan las competitivas: en un
// cooperativo ganan o pierden todos juntos y no dice quién juega mejor.
// Los invitados y los jugadores sin celular no entran (no tienen cuenta).

import { claveJuego, type PartidaDelHistorial } from "./historial";

type Jugador = PartidaDelHistorial["jugadores"][number];
type Partida = PartidaDelHistorial & { modo_resultado: string | null };

export type Persona = { id: string; nombre: string };

export type FilaRanking = Persona & {
  partidas: number;
  victorias: number;
  /** Entre 0 y 1; null si no jugó ninguna. */
  porcentaje: number | null;
  esYo: boolean;
};

const competitivas = (partidas: Partida[], juego: string | null) =>
  partidas.filter((p) => p.modo_resultado !== "cooperativo" && (!juego || claveJuego(p) === juego));

/**
 * Victorias y partidas de vos y tus amigos en las partidas que jugaste. Orden:
 * victorias, porcentaje y cantidad de partidas (de mayor a menor), y nombre.
 */
export function calcularRanking(
  partidas: Partida[],
  yo: Persona,
  amigos: Persona[],
  juego: string | null = null,
): FilaRanking[] {
  const personas = new Map([yo, ...amigos].map((p) => [p.id, p]));
  const cuenta = new Map<string, { partidas: number; victorias: number }>();
  for (const p of competitivas(partidas, juego)) {
    for (const j of p.jugadores) {
      if (!j.user_id || !personas.has(j.user_id)) continue;
      const c = cuenta.get(j.user_id) ?? { partidas: 0, victorias: 0 };
      c.partidas += 1;
      if (j.gano) c.victorias += 1;
      cuenta.set(j.user_id, c);
    }
  }
  return [...personas.values()]
    .map((persona) => {
      const c = cuenta.get(persona.id) ?? { partidas: 0, victorias: 0 };
      return {
        ...persona,
        ...c,
        porcentaje: c.partidas ? c.victorias / c.partidas : null,
        esYo: persona.id === yo.id,
      };
    })
    .filter((f) => f.partidas > 0 || f.esYo)
    .sort(
      (a, b) =>
        b.victorias - a.victorias ||
        (b.porcentaje ?? -1) - (a.porcentaje ?? -1) ||
        b.partidas - a.partidas ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
}

/** Quién le ganó a quién en una partida: el que ganó o, si no, la mejor posición. */
export function duelo(mio: Jugador, suyo: Jugador): "gane" | "perdi" | "empate" {
  if (mio.gano !== suyo.gano) return mio.gano ? "gane" : "perdi";
  if (mio.posicion !== null && suyo.posicion !== null && mio.posicion !== suyo.posicion) {
    return mio.posicion < suyo.posicion ? "gane" : "perdi";
  }
  return "empate";
}

export type CaraACara = Persona & {
  juntos: number;
  gane: number;
  perdi: number;
  empates: number;
};

/** Para cada amigo con el que jugaste: cuántas veces quedaste por encima y por debajo. */
export function calcularCaraACara(
  partidas: Partida[],
  yo: string,
  amigos: Persona[],
  juego: string | null = null,
): CaraACara[] {
  const filas = new Map<string, CaraACara>(
    amigos.map((a) => [a.id, { ...a, juntos: 0, gane: 0, perdi: 0, empates: 0 }]),
  );
  for (const p of competitivas(partidas, juego)) {
    const mio = p.jugadores.find((j) => j.user_id === yo);
    if (!mio) continue;
    for (const suyo of p.jugadores) {
      const fila = suyo.user_id ? filas.get(suyo.user_id) : undefined;
      if (!fila) continue;
      fila.juntos += 1;
      const r = duelo(mio, suyo);
      if (r === "gane") fila.gane += 1;
      else if (r === "perdi") fila.perdi += 1;
      else fila.empates += 1;
    }
  }
  return [...filas.values()]
    .filter((f) => f.juntos > 0)
    .sort((a, b) => b.juntos - a.juntos || a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Tu némesis: el amigo que más veces te ganó, con saldo en contra (te ganó
 * más de lo que le ganaste). Null si no hay ninguno.
 */
export function nemesis(caraACara: CaraACara[]): CaraACara | null {
  const enContra = caraACara.filter((f) => f.perdi > f.gane);
  if (enContra.length === 0) return null;
  return enContra.reduce((peor, f) =>
    f.perdi - f.gane > peor.perdi - peor.gane ||
    (f.perdi - f.gane === peor.perdi - peor.gane && f.perdi > peor.perdi)
      ? f
      : peor,
  );
}
