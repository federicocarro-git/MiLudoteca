import { describe, expect, it } from "vitest";
import { notasPartidaSchema, terminarPartidaSchema } from "./partidas";

describe("terminarPartidaSchema", () => {
  it("acepta los modos y completa los valores por defecto", () => {
    expect(terminarPartidaSchema.parse({ modo: "mas_puntos" })).toEqual({
      modo: "mas_puntos",
      ganadores: [],
      ganamos: null,
    });
  });

  it("en un cooperativo exige saber si ganaron", () => {
    const r = terminarPartidaSchema.safeParse({ modo: "cooperativo" });
    expect(r.error?.issues[0].message).toBe("Elegí si ganaron o perdieron.");
    expect(terminarPartidaSchema.safeParse({ modo: "cooperativo", ganamos: false }).success).toBe(
      true,
    );
  });

  it("rechaza modos y ids inválidos", () => {
    expect(terminarPartidaSchema.safeParse({ modo: "otro" }).success).toBe(false);
    expect(terminarPartidaSchema.safeParse({ modo: "manual", ganadores: ["x"] }).success).toBe(
      false,
    );
  });
});

describe("notasPartidaSchema", () => {
  it("recorta y limita el largo", () => {
    expect(notasPartidaSchema.parse("  hola ")).toBe("hola");
    expect(notasPartidaSchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
});
