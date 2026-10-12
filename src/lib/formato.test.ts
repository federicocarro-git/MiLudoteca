import { describe, expect, it } from "vitest";
import {
  formatearComplejidad,
  formatearDuracion,
  formatearJugadores,
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
    expect(nivelDeComplejidad(2.29)).toBe("Medio-liviano");
    expect(nivelDeComplejidad(3)).toBe("Medio");
    expect(nivelDeComplejidad(3.9)).toBe("Medio-pesado");
    expect(nivelDeComplejidad(5)).toBe("Pesado");
    expect(nivelDeComplejidad(null)).toBeNull();
  });

  it("formatea con coma decimal", () => {
    expect(formatearComplejidad(2.29)).toBe("Medio-liviano (2,3/5)");
  });
});
