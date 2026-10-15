import { describe, expect, it } from "vitest";
import {
  casillerosVisibles,
  filasDeLaHoja,
  leerCategorias,
  puntajeMasAlto,
  soltarConfirmados,
  totalesDeLaHoja,
} from "./tipos";

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

describe("hoja por rondas o categorías", () => {
  it("arma las filas", () => {
    expect(filasDeLaHoja({ tipo_puntaje: "rondas", rondas: 3, categorias: [] })).toEqual([
      "Ronda 1",
      "Ronda 2",
      "Ronda 3",
    ]);
    expect(
      filasDeLaHoja({ tipo_puntaje: "categorias", rondas: 1, categorias: ["Militar", "Ciencia"] }),
    ).toEqual(["Militar", "Ciencia"]);
    expect(filasDeLaHoja({ tipo_puntaje: "total", rondas: 1, categorias: [] })).toEqual([]);
  });

  it("los cambios sin confirmar mandan, y null borra el casillero", () => {
    const casilleros = casillerosVisibles(
      [
        { jugador_id: "a", columna: 0, puntos: 5 },
        { jugador_id: "a", columna: 1, puntos: 2 },
        { jugador_id: "b", columna: 0, puntos: 7 },
      ],
      {
        "a:1": { puntos: null, guardadoEn: null },
        "b:1": { puntos: 4, guardadoEn: null },
      },
    );
    expect([...casilleros]).toEqual([
      ["a:0", 5],
      ["b:0", 7],
      ["b:1", 4],
    ]);
    const totales = totalesDeLaHoja([{ id: "a" }, { id: "b" }, { id: "c" }], casilleros);
    expect([...totales]).toEqual([
      ["a", 5],
      ["b", 11],
      ["c", 0],
    ]);
  });

  it("lee categorías por línea o por comas, sin vacías ni repetidas", () => {
    expect(leerCategorias(" Militar\nCiencia, ciencia ,\n\nComercio ")).toEqual([
      "Militar",
      "Ciencia",
      "Comercio",
    ]);
    expect(leerCategorias("x".repeat(40))).toEqual(["x".repeat(30)]);
    expect(leerCategorias(Array.from({ length: 25 }, (_, i) => `C${i}`).join("\n"))).toHaveLength(
      20,
    );
  });
});
