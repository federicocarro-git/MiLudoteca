import { describe, expect, it } from "vitest";
import { mensajeDeErrorAuth } from "./auth-errores";

describe("mensajeDeErrorAuth", () => {
  it("traduce códigos conocidos", () => {
    expect(mensajeDeErrorAuth("invalid_credentials")).toMatch(/no son correctos/);
    expect(mensajeDeErrorAuth("otp_expired")).toMatch(/venció/);
  });

  it("usa un mensaje genérico para el resto", () => {
    expect(mensajeDeErrorAuth("algo_raro")).toMatch(/No pudimos/);
    expect(mensajeDeErrorAuth(null)).toMatch(/No pudimos/);
    // No confundir con propiedades heredadas de Object.
    expect(mensajeDeErrorAuth("toString")).toMatch(/No pudimos/);
  });
});
