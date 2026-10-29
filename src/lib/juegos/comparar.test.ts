import { describe, expect, it } from "vitest";
import type { DatosJuego } from "@/lib/game-data/types";
import { escaparLike, mismosDatos } from "./comparar";

const base: DatosJuego = {
  bgg_id: 13,
  nombre: "CATAN",
  imagen_url: "https://cf.geekdo-images.com/a.jpg",
  jugadores_min: 3,
  jugadores_max: 4,
  duracion_min: 120,
  complejidad: 2.29,
  anio: 1995,
  descripcion: "Texto\nlargo",
  tipos: ["eurogame", "negociación"],
  es_expansion: false,
  expande: [],
};

describe("mismosDatos", () => {
  it("iguales aunque cambie el orden de tipos, los espacios o el formato numérico", () => {
    expect(
      mismosDatos(base, {
        ...base,
        nombre: " CATAN ",
        descripcion: "Texto\r\nlargo",
        tipos: ["negociación", "eurogame"],
        complejidad: "2.290" as unknown as number,
      }),
    ).toBe(true);
  });

  it("vacío y null son lo mismo", () => {
    expect(mismosDatos({ ...base, descripcion: null }, { ...base, descripcion: "" })).toBe(true);
  });

  it.each([
    ["nombre", "Catan"],
    ["jugadores_max", 5],
    ["complejidad", 2.3],
    ["imagen_url", null],
    ["tipos", ["eurogame"]],
  ])("distintos si cambia %s", (campo, valor) => {
    expect(mismosDatos(base, { ...base, [campo]: valor })).toBe(false);
  });
});

describe("escaparLike", () => {
  it("escapa %, _ y \\", () => {
    expect(escaparLike("100% _de\\")).toBe("100\\% \\_de\\\\");
  });
});
