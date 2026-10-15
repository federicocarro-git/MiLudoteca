import { describe, expect, it } from "vitest";
import { claveJuego, filtrarHistorial, miParticipacion, opcionesDeFiltro } from "./historial";

const YO = "yo";
const j = (user_id: string | null, nombre: string, gano = false) => ({
  user_id,
  nombre,
  gano,
  puntos: 0,
  posicion: null,
});
const partidas = [
  {
    id: "1",
    juego_id: "catan",
    juego_nombre: "Catan",
    jugadores: [j(YO, "Yo", true), j("b", "Beto")],
  },
  { id: "2", juego_id: null, juego_nombre: "Borrado", jugadores: [j(YO, "Yo"), j(null, "Abuela")] },
  {
    id: "3",
    juego_id: "catan",
    juego_nombre: "Catan",
    jugadores: [j(YO, "Yo"), j("c", "Caro", true)],
  },
];

describe("historial", () => {
  it("arma las opciones de juegos y personas, ordenadas", () => {
    const { juegos, personas } = opcionesDeFiltro(partidas, YO);
    expect(juegos).toEqual([
      { valor: "nombre:Borrado", etiqueta: "Borrado" },
      { valor: "catan", etiqueta: "Catan" },
    ]);
    expect(personas.map((p) => p.etiqueta)).toEqual(["Beto", "Caro"]);
  });

  it("filtra por juego y por persona", () => {
    expect(filtrarHistorial(partidas, { juego: "catan" }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filtrarHistorial(partidas, { con: "c" }).map((p) => p.id)).toEqual(["3"]);
    expect(filtrarHistorial(partidas, { juego: claveJuego(partidas[1]) }).map((p) => p.id)).toEqual(
      ["2"],
    );
    expect(filtrarHistorial(partidas, {})).toHaveLength(3);
  });

  it("encuentra mi participación", () => {
    expect(miParticipacion(partidas[0], YO)?.gano).toBe(true);
    expect(miParticipacion(partidas[0], "otro")).toBeNull();
  });
});
