import { describe, expect, it } from "vitest";
import { formularioEmailSchema } from "./auth";

describe("formularioEmailSchema", () => {
  it("normaliza el email", () => {
    const r = formularioEmailSchema.parse({ modo: "link", email: "  Ana@Ejemplo.COM " });
    expect(r.email).toBe("ana@ejemplo.com");
  });

  it("rechaza emails inválidos", () => {
    const r = formularioEmailSchema.safeParse({ modo: "link", email: "ana" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Ingresá un email válido.");
  });

  it("para crear cuenta exige 8 caracteres", () => {
    const corta = formularioEmailSchema.safeParse({
      modo: "crear",
      email: "a@b.com",
      password: "1234567",
    });
    expect(corta.success).toBe(false);
    expect(
      formularioEmailSchema.safeParse({ modo: "crear", email: "a@b.com", password: "12345678" })
        .success,
    ).toBe(true);
  });

  it("para ingresar solo exige que haya contraseña", () => {
    expect(
      formularioEmailSchema.safeParse({ modo: "ingresar", email: "a@b.com", password: "x" })
        .success,
    ).toBe(true);
    expect(
      formularioEmailSchema.safeParse({ modo: "ingresar", email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });

  it("rechaza modos desconocidos", () => {
    expect(formularioEmailSchema.safeParse({ modo: "otro", email: "a@b.com" }).success).toBe(false);
  });
});
