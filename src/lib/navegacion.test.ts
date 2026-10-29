import { describe, expect, it } from "vitest";
import { itemActivo } from "./navegacion";

describe("itemActivo", () => {
  it("marca la ruta más larga que coincide", () => {
    expect(itemActivo("/jugar")).toBe("/jugar");
    expect(itemActivo("/jugar/amigos")).toBe("/jugar");
    expect(itemActivo("/jugar/historial")).toBe("/jugar/historial");
    expect(itemActivo("/jugar/ranking")).toBe("/jugar/ranking");
    expect(itemActivo("/catalogo")).toBe("/catalogo");
  });

  it("agregar un juego cuenta como el Estante", () => {
    expect(itemActivo("/juegos/nuevo")).toBe("/catalogo");
  });

  it("nada fuera de la barra o sin ruta", () => {
    expect(itemActivo("/juegos/123")).toBeNull();
    expect(itemActivo("/jugarx")).toBeNull();
    expect(itemActivo(null)).toBeNull();
  });
});
