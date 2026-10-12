import { describe, expect, it } from "vitest";
import { RUTA_INICIO, destinoSeguro, esRutaPublica } from "./rutas";

describe("esRutaPublica", () => {
  it.each(["/login", "/auth/callback", "/offline"])("%s es pública", (ruta) => {
    expect(esRutaPublica(ruta)).toBe(true);
  });

  it.each(["/", "/catalogo", "/juegos/nuevo", "/loginx", "/authorizar"])(
    "%s requiere sesión",
    (ruta) => {
      expect(esRutaPublica(ruta)).toBe(false);
    },
  );
});

describe("destinoSeguro", () => {
  it("acepta rutas internas", () => {
    expect(destinoSeguro("/juegos/abc?tab=ficha")).toBe("/juegos/abc?tab=ficha");
  });

  it.each([null, undefined, "", "https://malo.com", "//malo.com", "/\\malo.com", "catalogo"])(
    "rechaza %s",
    (next) => {
      expect(destinoSeguro(next)).toBe(RUTA_INICIO);
    },
  );
});
