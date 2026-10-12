import { describe, expect, it } from "vitest";
import {
  contarFiltros,
  elegirAlAzar,
  escribirFiltros,
  filtrarCatalogo,
  leerFiltros,
  tiposDelCatalogo,
  type JuegoCatalogo,
} from "./filtros";

function juego(parcial: Partial<JuegoCatalogo> & { nombre: string }): JuegoCatalogo {
  return {
    id: parcial.nombre.toLowerCase(),
    imagen_url: null,
    jugadores_min: null,
    jugadores_max: null,
    duracion_min: null,
    complejidad: null,
    anio: null,
    tipos: [],
    puntuacion: null,
    agregado_en: "2026-10-01T00:00:00Z",
    ...parcial,
  };
}

const CATALOGO = [
  juego({
    nombre: "Catán",
    jugadores_min: 3,
    jugadores_max: 4,
    duracion_min: 90,
    complejidad: 2.29,
    tipos: ["eurogame"],
    puntuacion: 7,
    agregado_en: "2026-10-03T00:00:00Z",
  }),
  juego({
    nombre: "Código Secreto",
    jugadores_min: 2,
    jugadores_max: 8,
    duracion_min: 15,
    complejidad: 1.27,
    tipos: ["party", "palabras"],
    puntuacion: 9,
    agregado_en: "2026-10-01T00:00:00Z",
  }),
  juego({
    nombre: "Pandemic",
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 2.4,
    tipos: ["cooperativo"],
    agregado_en: "2026-10-02T00:00:00Z",
  }),
  juego({
    nombre: "Gloomhaven",
    jugadores_min: 1,
    jugadores_max: 4,
    duracion_min: 120,
    complejidad: 3.9,
    tipos: ["cooperativo", "temático"],
    puntuacion: 10,
  }),
  juego({
    nombre: "azul",
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 1.76,
  }),
  juego({ nombre: "Juego sin datos" }),
];

const nombres = (j: JuegoCatalogo[]) => j.map((x) => x.nombre);

describe("leerFiltros / escribirFiltros", () => {
  it("lee los filtros válidos", () => {
    expect(
      leerFiltros(
        new URLSearchParams(
          "jugadores=4&duracion=60&complejidad=medio&tipo=cooperativo&q=%20cat%20&orden=recientes",
        ),
      ),
    ).toEqual({
      jugadores: 4,
      duracion: 60,
      complejidad: "medio",
      tipo: "cooperativo",
      q: "cat",
      orden: "recientes",
    });
  });

  it("ignora lo inválido", () => {
    expect(
      leerFiltros({
        jugadores: "0",
        duracion: "-5",
        complejidad: "extremo",
        tipo: "inventado",
        q: "  ",
        orden: "toString",
      }),
    ).toEqual({});
    expect(leerFiltros({ jugadores: "4.5", duracion: "abc" })).toEqual({});
  });

  it("acepta arrays (searchParams de Next) y usa el primero", () => {
    expect(leerFiltros({ jugadores: ["3", "5"] })).toEqual({ jugadores: 3 });
  });

  it("ida y vuelta, con 'nombre' como orden por defecto omitido", () => {
    const filtros = {
      q: "catan",
      jugadores: 4,
      duracion: 60,
      complejidad: "liviano",
      tipo: "party",
      orden: "puntuacion",
    } as const;
    const qs = escribirFiltros(filtros);
    expect(qs).toBe(
      "q=catan&jugadores=4&duracion=60&complejidad=liviano&tipo=party&orden=puntuacion",
    );
    expect(leerFiltros(new URLSearchParams(qs))).toEqual(filtros);
    expect(escribirFiltros({ orden: "nombre" })).toBe("");
  });

  it("cuenta los filtros activos sin la búsqueda ni el orden", () => {
    expect(contarFiltros({ q: "x", orden: "recientes" })).toBe(0);
    expect(contarFiltros({ jugadores: 2, tipo: "party" })).toBe(2);
  });
});

describe("filtrarCatalogo", () => {
  it("sin filtros devuelve todo ordenado por nombre (sin distinguir mayúsculas ni tildes)", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, {}))).toEqual([
      "azul",
      "Catán",
      "Código Secreto",
      "Gloomhaven",
      "Juego sin datos",
      "Pandemic",
    ]);
  });

  it("jugadores: el juego tiene que admitir esa cantidad", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, { jugadores: 6 }))).toEqual(["Código Secreto"]);
    expect(nombres(filtrarCatalogo(CATALOGO, { jugadores: 1 }))).toEqual(["Gloomhaven"]);
  });

  it("duración máxima", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, { duracion: 45 }))).toEqual([
      "azul",
      "Código Secreto",
      "Pandemic",
    ]);
  });

  it("complejidad por nivel (límite inferior incluido, superior excluido)", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, { complejidad: "liviano" }))).toEqual([
      "azul",
      "Código Secreto",
    ]);
    expect(nombres(filtrarCatalogo(CATALOGO, { complejidad: "medio" }))).toEqual([
      "Catán",
      "Pandemic",
    ]);
    expect(nombres(filtrarCatalogo(CATALOGO, { complejidad: "pesado" }))).toEqual(["Gloomhaven"]);
    expect(
      nombres(filtrarCatalogo([juego({ nombre: "X", complejidad: 5 })], { complejidad: "pesado" })),
    ).toEqual(["X"]);
  });

  it("tipo", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, { tipo: "cooperativo" }))).toEqual([
      "Gloomhaven",
      "Pandemic",
    ]);
  });

  it("búsqueda sin tildes ni mayúsculas, por parte del nombre", () => {
    expect(nombres(filtrarCatalogo(CATALOGO, { q: "CATAN" }))).toEqual(["Catán"]);
    expect(nombres(filtrarCatalogo(CATALOGO, { q: "secre" }))).toEqual(["Código Secreto"]);
  });

  it("combina filtros", () => {
    expect(
      nombres(filtrarCatalogo(CATALOGO, { jugadores: 4, duracion: 60, tipo: "cooperativo" })),
    ).toEqual(["Pandemic"]);
  });

  it("un juego sin el dato no pasa el filtro de ese dato", () => {
    for (const filtros of [
      { jugadores: 2 },
      { duracion: 500 },
      { complejidad: "liviano" as const },
    ]) {
      expect(nombres(filtrarCatalogo(CATALOGO, filtros))).not.toContain("Juego sin datos");
    }
  });

  it("ordena por recientes, puntuación y duración (nulos al final)", () => {
    const sinNulos = CATALOGO.slice(0, 3);
    expect(nombres(filtrarCatalogo(sinNulos, { orden: "recientes" }))).toEqual([
      "Catán",
      "Pandemic",
      "Código Secreto",
    ]);
    expect(nombres(filtrarCatalogo(CATALOGO, { orden: "puntuacion" })).slice(0, 3)).toEqual([
      "Gloomhaven",
      "Código Secreto",
      "Catán",
    ]);
    expect(nombres(filtrarCatalogo(CATALOGO, { orden: "duracion" })).at(-1)).toBe(
      "Juego sin datos",
    );
    expect(nombres(filtrarCatalogo(CATALOGO, { orden: "duracion" }))[0]).toBe("Código Secreto");
  });

  it("no modifica el arreglo original", () => {
    const copia = [...CATALOGO];
    filtrarCatalogo(CATALOGO, { orden: "puntuacion" });
    expect(CATALOGO).toEqual(copia);
  });
});

describe("tiposDelCatalogo", () => {
  it("devuelve solo los tipos usados, en el orden del vocabulario", () => {
    expect(tiposDelCatalogo(CATALOGO)).toEqual([
      "cooperativo",
      "eurogame",
      "palabras",
      "party",
      "temático",
    ]);
  });
});

describe("elegirAlAzar", () => {
  const lista = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("usa la función de azar", () => {
    expect(elegirAlAzar(lista, undefined, () => 0)?.id).toBe("a");
    expect(elegirAlAzar(lista, undefined, () => 0.99)?.id).toBe("c");
  });

  it("no repite el anterior si hay alternativas", () => {
    for (let i = 0; i < 50; i++) expect(elegirAlAzar(lista, "b")?.id).not.toBe("b");
  });

  it("con un solo juego lo repite; sin juegos devuelve null", () => {
    expect(elegirAlAzar([{ id: "a" }], "a")?.id).toBe("a");
    expect(elegirAlAzar([], "a")).toBeNull();
  });
});
