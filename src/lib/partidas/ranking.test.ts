import { describe, expect, it } from "vitest";
import {
  calcularCaraACara,
  calcularDuplas,
  calcularRanking,
  calcularRankingCooperativo,
  duelo,
  nemesis,
} from "./ranking";

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

describe("cooperativos", () => {
  const coop = (id: string, juego: string, ganaron: boolean, ...ids: string[]) => ({
    id,
    juego_id: juego,
    juego_nombre: juego,
    modo_resultado: "cooperativo",
    jugadores: [...ids.map((u) => j(u, ganaron, null)), j(null, ganaron, null, "Invitado")],
  });
  const coops = [
    coop("c1", "pandemic", true, "yo", "b"),
    coop("c2", "pandemic", true, "yo", "b", "c"),
    coop("c3", "pandemic", false, "yo", "b"),
    coop("c4", "spirit", true, "b", "c"),
    ...partidas, // las competitivas no cuentan acá
  ];

  it("cuenta jugadas y ganadas por persona", () => {
    const filas = calcularRankingCooperativo(coops, YO, [BETO, CARO]);
    expect(filas.map((f) => [f.nombre, f.ganadas, f.partidas])).toEqual([
      // Con las mismas ganadas, primero el mejor porcentaje. Caro y Yo suman
      // el Pandemic ganado de la lista de arriba.
      ["Caro", 3, 3],
      ["Beto", 3, 4],
      ["Yo", 3, 4],
    ]);
  });

  it("arma las duplas, con vos primero", () => {
    const duplas = calcularDuplas(coops, YO, [BETO, CARO], "pandemic");
    expect(
      duplas.map((d) => [
        d.personas.map((p) => p.nombre).join(" y "),
        d.ganadas,
        d.juntas,
        d.conmigo,
      ]),
    ).toEqual([
      ["Yo y Caro", 2, 2, true],
      ["Yo y Beto", 2, 3, true],
      ["Beto y Caro", 1, 1, false],
    ]);
  });

  it("filtra por juego", () => {
    const duplas = calcularDuplas(coops, YO, [BETO, CARO], "spirit");
    expect(duplas.map((d) => d.personas.map((p) => p.nombre))).toEqual([["Beto", "Caro"]]);
  });
});
