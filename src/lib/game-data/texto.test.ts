import { describe, expect, it } from "vitest";
import { normalizar, ordenarPorRelevancia } from "./texto";

describe("normalizar", () => {
  it("saca tildes y pasa a minúsculas", () => {
    expect(normalizar("  Catán ÉPICO ")).toBe("catan epico");
  });
});

describe("ordenarPorRelevancia", () => {
  it("exacto, después prefijo, después el resto (estable)", () => {
    const items = ["Catan: Ciudades", "Los Colonos de Catan", "Catan", "Catan Junior"].map(
      (nombre) => ({
        nombre,
      }),
    );
    expect(ordenarPorRelevancia(items, "catán").map((i) => i.nombre)).toEqual([
      "Catan",
      "Catan: Ciudades",
      "Catan Junior",
      "Los Colonos de Catan",
    ]);
  });
});
