import { describe, expect, it } from "vitest";
import { configurarPuntajeSchema } from "./puntaje";

describe("configurarPuntajeSchema", () => {
  it("rondas y total no necesitan categorías", () => {
    expect(configurarPuntajeSchema.parse({ tipo: "rondas" })).toEqual({
      tipo: "rondas",
      categorias: [],
      guardarPara: null,
    });
  });

  it("una hoja necesita categorías válidas", () => {
    expect(configurarPuntajeSchema.safeParse({ tipo: "categorias" }).error?.issues[0].message).toBe(
      "Escribí al menos una categoría.",
    );
    expect(
      configurarPuntajeSchema.safeParse({ tipo: "categorias", categorias: ["x".repeat(31)] })
        .success,
    ).toBe(false);
    expect(
      configurarPuntajeSchema.safeParse({ tipo: "categorias", categorias: Array(21).fill("x") })
        .success,
    ).toBe(false);
  });
});
