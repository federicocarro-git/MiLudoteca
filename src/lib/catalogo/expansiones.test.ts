import { describe, expect, it } from "vitest";
import { organizarEstante } from "./expansiones";
import type { JuegoCatalogo } from "./filtros";

function juego(nombre: string, bgg_id: number | null, expande: number[] = []): JuegoCatalogo {
  return {
    id: nombre,
    bgg_id,
    es_expansion: expande.length > 0,
    expande,
    nombre,
    imagen_url: null,
    jugadores_min: null,
    jugadores_max: null,
    duracion_min: null,
    complejidad: null,
    anio: null,
    tipos: [],
    puntuacion: null,
    agregado_en: "2026-10-28T00:00:00Z",
  };
}

describe("organizarEstante", () => {
  it("guarda las expansiones adentro de su juego base", () => {
    const estante = organizarEstante([
      juego("Catan", 13),
      juego("Navegantes", 325, [13]),
      juego("Ciudades y Caballeros", 926, [13]),
      juego("Azul", 230802),
    ]);
    expect(estante.map((j) => [j.nombre, j.expansiones])).toEqual([
      ["Catan", 2],
      ["Azul", 0],
    ]);
  });

  it("una expansión sin su juego base se muestra sola", () => {
    const estante = organizarEstante([juego("Europa 1912", 31627, [9209]), juego("Catan", 13)]);
    expect(estante.map((j) => [j.nombre, j.es_expansion, j.expansiones])).toEqual([
      ["Europa 1912", true, 0],
      ["Catan", false, 0],
    ]);
  });

  it("una expansión de varios juegos cuenta en cada uno que esté", () => {
    const estante = organizarEstante([
      juego("Catan", 13),
      juego("Catan 5-6", 926),
      juego("Navegantes 5-6", 2807, [13, 926, 13]),
    ]);
    expect(estante.map((j) => [j.nombre, j.expansiones])).toEqual([
      ["Catan", 1],
      ["Catan 5-6", 1],
    ]);
  });

  it("los juegos manuales sin bgg_id quedan como están", () => {
    expect(organizarEstante([juego("Truco", null)])).toMatchObject([
      { nombre: "Truco", expansiones: 0 },
    ]);
  });
});
