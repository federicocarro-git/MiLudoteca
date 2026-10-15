import { describe, expect, it } from "vitest";
import { codigoSalaSchema, nombreJugadorSchema, puntosSchema } from "./salas";

describe("codigoSalaSchema", () => {
  it("normaliza y valida el código", () => {
    expect(codigoSalaSchema.parse(" abc-def ")).toBe("ABCDEF");
    expect(codigoSalaSchema.safeParse("").error?.issues[0].message).toBe(
      "Escribí el código de la sala.",
    );
    expect(codigoSalaSchema.safeParse("ABCDE1").success).toBe(false);
  });
});

describe("nombreJugadorSchema", () => {
  it("recorta y exige un nombre", () => {
    expect(nombreJugadorSchema.parse(" Gabi ")).toBe("Gabi");
    expect(nombreJugadorSchema.safeParse("  ").success).toBe(false);
  });
});

describe("puntosSchema", () => {
  it("acepta enteros, también negativos", () => {
    expect(puntosSchema.parse(-3)).toBe(-3);
    expect(puntosSchema.safeParse(1.5).success).toBe(false);
    expect(puntosSchema.safeParse(Number.NaN).success).toBe(false);
    expect(puntosSchema.safeParse(2_000_000).success).toBe(false);
  });
});
