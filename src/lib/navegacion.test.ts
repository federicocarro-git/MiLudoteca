import { describe, expect, it } from "vitest";
import { itemActivo } from "./navegacion";

describe("itemActivo", () => {
  it("marca la ruta más larga que coincide", () => {
    expect(itemActivo("/jugar")).toBe("/jugar");
    expect(itemActivo("/jugar/historial")).toBe("/jugar");
    expect(itemActivo("/jugar/ranking")).toBe("/jugar/ranking");
    expect(itemActivo("/catalogo")).toBe("/catalogo");
    expect(itemActivo("/juegos/nuevo")).toBe("/juegos/nuevo");
  });

  it("nada fuera de la barra o sin ruta", () => {
    expect(itemActivo("/juegos/123")).toBeNull();
    expect(itemActivo("/jugarx")).toBeNull();
    expect(itemActivo(null)).toBeNull();
  });
});
