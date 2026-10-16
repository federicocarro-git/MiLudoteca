import { describe, expect, it } from "vitest";
import { mensajeDeErrorAuth, mensajeDeErrorInvitado } from "./auth-errores";

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

describe("mensajeDeErrorInvitado", () => {
  it("explica por qué no se puede entrar como invitado", () => {
    expect(mensajeDeErrorInvitado("anonymous_provider_disabled")).toMatch(/no está habilitado/);
    expect(mensajeDeErrorInvitado("captcha_failed")).toMatch(/anti-bots/);
    expect(mensajeDeErrorInvitado(undefined, 429)).toMatch(/demasiados invitados/);
    expect(mensajeDeErrorInvitado("otra_cosa")).toBe(
      "No se pudo entrar como invitado. Probá de nuevo.",
    );
  });
});
