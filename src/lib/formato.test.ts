import { describe, expect, it } from "vitest";
import {
  colorDeNombre,
  formatearCantidades,
  formatearRecomendados,
  formatearDuracion,
  formatearJugadores,
  jugadoresCorto,
  nivelDeComplejidad,
} from "./formato";

describe("formatearJugadores", () => {
  it.each([
    [2, 4, "2–4 jugadores"],
    [2, 2, "2 jugadores"],
    [1, 1, "1 jugador"],
    [3, null, "3+ jugadores"],
    [null, 5, "Hasta 5 jugadores"],
    [null, null, null],
  ])("%s, %s → %s", (min, max, esperado) => {
    expect(formatearJugadores(min, max)).toBe(esperado);
  });
});

describe("formatearDuracion", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [null, null],
  ])("%s → %s", (min, esperado) => {
    expect(formatearDuracion(min)).toBe(esperado);
  });
});

describe("complejidad", () => {
  it("asigna niveles", () => {
    expect(nivelDeComplejidad(1.2)).toBe("Liviano");
    expect(nivelDeComplejidad(1.99)).toBe("Liviano");
    expect(nivelDeComplejidad(2)).toBe("Mediano");
    expect(nivelDeComplejidad(2.29)).toBe("Mediano");
    expect(nivelDeComplejidad(3)).toBe("Pesado");
    expect(nivelDeComplejidad(5)).toBe("Pesado");
    expect(nivelDeComplejidad(null)).toBeNull();
  });
});

describe("jugadoresCorto", () => {
  it.each([
    [2, 4, "2–4"],
    [2, 2, "2"],
    [3, null, "3+"],
    [null, 5, "≤5"],
    [null, null, null],
  ])("%s, %s → %s", (min, max, esperado) => {
    expect(jugadoresCorto(min, max)).toBe(esperado);
  });
});

describe("colorDeNombre", () => {
  it("siempre el mismo color para el mismo nombre", () => {
    expect(colorDeNombre("Beto")).toBe(colorDeNombre(" beto "));
    expect(colorDeNombre("Beto")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("reparte nombres distintos entre varios colores", () => {
    const colores = new Set(["Ana", "Beto", "Caro", "Dani", "Eli", "Fran"].map(colorDeNombre));
    expect(colores.size).toBeGreaterThan(2);
  });
});

describe("formatearRecomendados", () => {
  it("junta los tramos seguidos", () => {
    expect(formatearCantidades([4, 2, 5, 6])).toBe("2, 4–6");
    expect(formatearCantidades([3])).toBe("3");
  });

  it("ideal y recomendado en una frase", () => {
    expect(formatearRecomendados([4], [3, 4])).toBe("Ideal con 4 · recomendado con 3–4");
    expect(formatearRecomendados([], [2, 3])).toBe("Recomendado con 2–3");
    expect(formatearRecomendados(null, null)).toBeNull();
    expect(formatearRecomendados([], [])).toBeNull();
  });
});
