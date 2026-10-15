import { describe, expect, it } from "vitest";
import { codigoAmigoSchema, nombrePerfilSchema, normalizarCodigo } from "./amigos";

describe("codigoAmigoSchema", () => {
  it("normaliza minúsculas, espacios y guiones", () => {
    expect(normalizarCodigo(" k7q-4mx ")).toBe("K7Q4MX");
    expect(codigoAmigoSchema.parse("k7q 4mx")).toBe("K7Q4MX");
  });

  it("rechaza códigos vacíos, cortos o con letras ambiguas", () => {
    expect(codigoAmigoSchema.safeParse("").error?.issues[0].message).toBe(
      "Escribí el código de tu amigo.",
    );
    expect(codigoAmigoSchema.safeParse("ABC").success).toBe(false);
    expect(codigoAmigoSchema.safeParse("ABCDE0").success).toBe(false);
    expect(codigoAmigoSchema.safeParse("ABCDEI").success).toBe(false);
  });
});

describe("nombrePerfilSchema", () => {
  it("recorta espacios y limita el largo", () => {
    expect(nombrePerfilSchema.parse("  Ana ")).toBe("Ana");
    expect(nombrePerfilSchema.safeParse("   ").success).toBe(false);
    expect(nombrePerfilSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});
