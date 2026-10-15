import { describe, expect, it } from "vitest";
import { puntajeMasAlto, soltarConfirmados } from "./tipos";

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

describe("soltarConfirmados", () => {
  it("suelta solo lo guardado antes de que empezara la recarga", () => {
    const pendientes = {
      a: { puntos: 5, guardadoEn: 100 },
      b: { puntos: 7, guardadoEn: null },
      c: { puntos: 9, guardadoEn: 300 },
    };
    expect(soltarConfirmados(pendientes, 200)).toEqual({
      b: { puntos: 7, guardadoEn: null },
      c: { puntos: 9, guardadoEn: 300 },
    });
  });

  it("devuelve el mismo objeto si no cambia nada", () => {
    const pendientes = { a: { puntos: 5, guardadoEn: null } };
    expect(soltarConfirmados(pendientes, 200)).toBe(pendientes);
  });
});
