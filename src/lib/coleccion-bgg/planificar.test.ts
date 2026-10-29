import { describe, expect, it } from "vitest";
import type { ItemColeccion } from "@/lib/game-data/types";
import { enTandas, planificarImportacion } from "./planificar";

const item = (bgg_id: number, nombre: string, es_expansion = false): ItemColeccion => ({
  bgg_id,
  nombre,
  anio: null,
  es_expansion,
  puntuacion: null,
});

describe("planificarImportacion", () => {
  const coleccion = [
    item(325, "Catan: Navegantes", true),
    item(13, "CATAN"),
    item(822, "Carcassonne"),
    item(30549, "Pandémic"),
  ];

  it("trae lo que falta, primero los juegos base", () => {
    expect(planificarImportacion(coleccion, [])).toEqual({
      nuevos: [coleccion[1], coleccion[2], coleccion[3], coleccion[0]],
      yaEstaban: 0,
    });
  });

  it("saltea lo que ya está por bgg_id o por nombre sin tildes ni mayúsculas", () => {
    const { nuevos, yaEstaban } = planificarImportacion(coleccion, [
      { bgg_id: 13, nombre: "Catan (edición vieja)" },
      { bgg_id: null, nombre: "pandemic" },
    ]);
    expect(nuevos.map((n) => n.bgg_id)).toEqual([822, 325]);
    expect(yaEstaban).toBe(2);
  });
});

describe("enTandas", () => {
  it("de a 20 por defecto", () => {
    const tandas = enTandas(Array.from({ length: 45 }, (_, i) => i));
    expect(tandas.map((t) => t.length)).toEqual([20, 20, 5]);
    expect(enTandas([])).toEqual([]);
  });
});
