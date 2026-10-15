import { describe, expect, it } from "vitest";
import { calcularCaraACara, calcularRanking, duelo, nemesis } from "./ranking";

const YO = { id: "yo", nombre: "Yo" };
const BETO = { id: "b", nombre: "Beto" };
const CARO = { id: "c", nombre: "Caro" };

const j = (user_id: string | null, gano: boolean, posicion: number | null, nombre = "x") => ({
  user_id,
  nombre,
  gano,
  puntos: 0,
  posicion,
});

const partidas = [
  // Catan: gano yo, Beto segundo, un invitado tercero.
  {
    id: "1",
    juego_id: "catan",
    juego_nombre: "Catan",
    modo_resultado: "mas_puntos",
    jugadores: [j("yo", true, 1), j("b", false, 2), j(null, false, 3, "Abuela")],
  },
  // Catan: gana Beto, Caro y yo empatados segundos.
  {
    id: "2",
    juego_id: "catan",
    juego_nombre: "Catan",
    modo_resultado: "mas_puntos",
    jugadores: [j("yo", false, 2), j("b", true, 1), j("c", false, 2)],
  },
  // Dixit: gana Beto.
  {
    id: "3",
    juego_id: "dixit",
    juego_nombre: "Dixit",
    modo_resultado: "mas_puntos",
    jugadores: [j("yo", false, 2), j("b", true, 1)],
  },
  // Cooperativo ganado: no cuenta.
  {
    id: "4",
    juego_id: "pandemic",
    juego_nombre: "Pandemic",
    modo_resultado: "cooperativo",
    jugadores: [j("yo", true, null), j("c", true, null)],
  },
];

describe("calcularRanking", () => {
  it("cuenta victorias y partidas competitivas de vos y tus amigos", () => {
    const ranking = calcularRanking(partidas, YO, [BETO, CARO]);
    expect(ranking.map((f) => [f.nombre, f.victorias, f.partidas])).toEqual([
      ["Beto", 2, 3],
      ["Yo", 1, 3],
      ["Caro", 0, 1],
    ]);
    expect(ranking[0].porcentaje).toBeCloseTo(2 / 3);
    expect(ranking.find((f) => f.esYo)?.nombre).toBe("Yo");
  });

  it("filtra por juego y deja afuera a los amigos que no jugaron", () => {
    const ranking = calcularRanking(
      partidas,
      YO,
      [BETO, CARO, { id: "z", nombre: "Zoe" }],
      "dixit",
    );
    expect(ranking.map((f) => f.nombre)).toEqual(["Beto", "Yo"]);
  });

  it("si no jugaste nada, estás vos solo con 0", () => {
    expect(calcularRanking([], YO, [BETO])).toEqual([
      { ...YO, partidas: 0, victorias: 0, porcentaje: null, esYo: true },
    ]);
  });
});

describe("duelo", () => {
  it("gana quien ganó; si no, la mejor posición; si no, empate", () => {
    expect(duelo(j("yo", true, 1), j("b", false, 2))).toBe("gane");
    expect(duelo(j("yo", false, 3), j("b", false, 2))).toBe("perdi");
    expect(duelo(j("yo", false, 2), j("c", false, 2))).toBe("empate");
    expect(duelo(j("yo", true, 1), j("b", true, 1))).toBe("empate");
    // A mano: ganó aunque tenga peor posición.
    expect(duelo(j("yo", true, 2), j("b", false, 1))).toBe("gane");
  });
});

describe("cara a cara y némesis", () => {
  it("cuenta los duelos con cada amigo", () => {
    const filas = calcularCaraACara(partidas, "yo", [BETO, CARO]);
    expect(filas.map((f) => [f.nombre, f.juntos, f.gane, f.perdi, f.empates])).toEqual([
      ["Beto", 3, 1, 2, 0],
      ["Caro", 1, 0, 0, 1],
    ]);
    expect(nemesis(filas)?.nombre).toBe("Beto");
  });

  it("sin saldo en contra no hay némesis", () => {
    const filas = calcularCaraACara(partidas.slice(0, 1), "yo", [BETO]);
    expect(nemesis(filas)).toBeNull();
  });
});
