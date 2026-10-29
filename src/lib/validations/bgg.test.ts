import { describe, expect, it } from "vitest";
import { tandaBggSchema, usuarioBggSchema } from "./bgg";

describe("usuarioBggSchema", () => {
  it.each(["fede", " Fede_Carro ", "jugador 1", "a.b-c"])("acepta %j", (u) => {
    expect(usuarioBggSchema.safeParse(u).success).toBe(true);
  });

  it.each(["", "   ", "fede@mail.com", "-fede", "x".repeat(51)])("rechaza %j", (u) => {
    expect(usuarioBggSchema.safeParse(u).success).toBe(false);
  });

  it("quita los espacios de los bordes", () => {
    expect(usuarioBggSchema.parse("  fede ")).toBe("fede");
  });
});

describe("tandaBggSchema", () => {
  it("de 1 a 20 juegos con puntuación de 1 a 10 o null", () => {
    expect(tandaBggSchema.safeParse([{ bgg_id: 13, puntuacion: 8 }]).success).toBe(true);
    expect(tandaBggSchema.safeParse([{ bgg_id: 13, puntuacion: null }]).success).toBe(true);
    expect(tandaBggSchema.safeParse([]).success).toBe(false);
    expect(tandaBggSchema.safeParse([{ bgg_id: 13, puntuacion: 11 }]).success).toBe(false);
    expect(
      tandaBggSchema.safeParse(
        Array.from({ length: 21 }, (_, i) => ({ bgg_id: i + 1, puntuacion: null })),
      ).success,
    ).toBe(false);
  });
});
