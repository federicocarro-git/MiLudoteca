import { describe, expect, it } from "vitest";
import {
  agruparPorJuego,
  claveDeJuego,
  duenosDeLosJuegos,
  filtrarJuegosDeAmigos,
  filtrarPorDuenos,
  juegosParaLaMesa,
  type FilaJuegoAjeno,
} from "./juegos";

const fila = (
  dueno: [string, string],
  juego: Partial<FilaJuegoAjeno> & { nombre: string },
): FilaJuegoAjeno => ({
  dueno_id: dueno[0],
  dueno_nombre: dueno[1],
  juego_id: `id-${juego.nombre}-${dueno[0]}`,
  bgg_id: null,
  imagen_url: null,
  jugadores_min: null,
  jugadores_max: null,
  duracion_min: null,
  complejidad: null,
  tipos: [],
  ...juego,
});

const BETO: [string, string] = ["b", "Beto"];
const CARO: [string, string] = ["c", "Caro"];

describe("agruparPorJuego", () => {
  it("junta el mismo juego por id de BGG o por nombre, con sus dueños", () => {
    const juegos = agruparPorJuego([
      fila(CARO, { nombre: "Catan", bgg_id: 13 }),
      fila(BETO, { nombre: "Catan (edición vieja)", bgg_id: 13 }),
      fila(BETO, { nombre: "Ástrid" }),
      fila(CARO, { nombre: "astrid " }),
      fila(BETO, { nombre: "Dixit" }),
    ]);
    expect(juegos.map((j) => [j.nombre, j.duenos.map((d) => d.nombre)])).toEqual([
      ["Ástrid", ["Beto", "Caro"]],
      ["Catan", ["Beto", "Caro"]],
      ["Dixit", ["Beto"]],
    ]);
  });

  it("elige el nombre más repetido o con mayúsculas y completa datos faltantes", () => {
    const [juego] = agruparPorJuego([
      fila(CARO, { nombre: "catan casero" }),
      fila(BETO, { nombre: "Catan casero", jugadores_min: 3, jugadores_max: 4 }),
    ]);
    expect(juego.nombre).toBe("Catan casero");
    expect([juego.jugadores_min, juego.jugadores_max]).toEqual([3, 4]);
    const [otro] = agruparPorJuego([
      fila(CARO, { nombre: "dixit" }),
      fila(BETO, { nombre: "dixit" }),
      fila(["d", "Dani"], { nombre: "Dixit" }),
    ]);
    expect(otro.nombre).toBe("dixit");
  });

  it("la clave usa BGG si hay y si no el nombre normalizado", () => {
    expect(claveDeJuego({ bgg_id: 13, nombre: "x" })).toBe("bgg:13");
    expect(claveDeJuego({ bgg_id: null, nombre: " Ástrid" })).toBe("nombre:astrid");
  });
});

describe("juegosParaLaMesa", () => {
  const juegos = [
    { id: "2a4", jugadores_min: 2, jugadores_max: 4, duracion_min: 60 },
    { id: "3a6", jugadores_min: 3, jugadores_max: 6, duracion_min: 30 },
    { id: "sin", jugadores_min: null, jugadores_max: null, duracion_min: 20 },
  ];

  it("filtra por cantidad de jugadores; sin datos no pasa", () => {
    expect(juegosParaLaMesa(juegos, 4).map((j) => j.id)).toEqual(["2a4", "3a6"]);
    expect(juegosParaLaMesa(juegos, 5).map((j) => j.id)).toEqual(["3a6"]);
  });

  it("y por duración máxima", () => {
    expect(juegosParaLaMesa(juegos, 4, 45).map((j) => j.id)).toEqual(["3a6"]);
  });
});

describe("filtrarJuegosDeAmigos", () => {
  const juegos = agruparPorJuego([
    fila(BETO, { nombre: "Catán" }),
    fila(CARO, { nombre: "Dixit" }),
  ]);

  it("por nombre sin tildes y por amigo", () => {
    expect(filtrarJuegosDeAmigos(juegos, { q: "catan" }).map((j) => j.nombre)).toEqual(["Catán"]);
    expect(filtrarJuegosDeAmigos(juegos, { amigo: "c" }).map((j) => j.nombre)).toEqual(["Dixit"]);
    expect(filtrarJuegosDeAmigos(juegos, {})).toHaveLength(2);
  });
});

describe("dueños de los juegos de la mesa", () => {
  const juegos = agruparPorJuego([
    fila(CARO, { nombre: "Catan" }),
    fila(BETO, { nombre: "Catan" }),
    fila(BETO, { nombre: "Dixit" }),
    fila(["a", "Ana"], { nombre: "Azul" }),
  ]);

  it("lista los dueños sin repetir, por nombre", () => {
    expect(duenosDeLosJuegos(juegos).map((d) => d.nombre)).toEqual(["Ana", "Beto", "Caro"]);
  });

  it("filtra por uno o varios dueños; sin elegir, todos", () => {
    expect(filtrarPorDuenos(juegos, ["c"]).map((j) => j.nombre)).toEqual(["Catan"]);
    expect(filtrarPorDuenos(juegos, ["a", "c"]).map((j) => j.nombre)).toEqual(["Azul", "Catan"]);
    expect(filtrarPorDuenos(juegos, [])).toHaveLength(3);
  });
});
