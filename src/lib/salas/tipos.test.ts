import { describe, expect, it } from "vitest";
import { puntajeMasAlto } from "./tipos";

describe("puntajeMasAlto", () => {
  it("marca a quien va ganando, también empates", () => {
    expect(
      puntajeMasAlto([
        { id: "a", puntos: 3 },
        { id: "b", puntos: 5 },
      ]),
    ).toEqual(new Set(["b"]));
    expect(
      puntajeMasAlto([
        { id: "a", puntos: 5 },
        { id: "b", puntos: 5 },
        { id: "c", puntos: -1 },
      ]),
    ).toEqual(new Set(["a", "b"]));
  });

  it("no marca a nadie si están todos iguales o hay un solo jugador", () => {
    expect(
      puntajeMasAlto([
        { id: "a", puntos: 0 },
        { id: "b", puntos: 0 },
      ]).size,
    ).toBe(0);
    expect(puntajeMasAlto([{ id: "a", puntos: 10 }]).size).toBe(0);
  });
});
