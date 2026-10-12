import { describe, expect, it } from "vitest";
import { resumenSchema, seccionDesdeUrl } from "./resumen";

describe("resumenSchema", () => {
  it("normaliza saltos de línea y espacios finales", () => {
    expect(
      resumenSchema.parse({ como_se_juega: "## A\r\nb  \n\n", hoja_de_turno: undefined }),
    ).toEqual({
      como_se_juega: "## A\nb",
      hoja_de_turno: "",
    });
  });

  it("limita el largo", () => {
    const r = resumenSchema.safeParse({ como_se_juega: "", hoja_de_turno: "x".repeat(50_001) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/Hoja de turno: máximo 50\.000/);
  });
});

describe("seccionDesdeUrl", () => {
  it("acepta las dos secciones y usa 'como-se-juega' por defecto", () => {
    expect(seccionDesdeUrl("hoja-de-turno")).toBe("hoja-de-turno");
    expect(seccionDesdeUrl("como-se-juega")).toBe("como-se-juega");
    expect(seccionDesdeUrl(undefined)).toBe("como-se-juega");
    expect(seccionDesdeUrl(["hoja-de-turno"])).toBe("como-se-juega");
  });
});
