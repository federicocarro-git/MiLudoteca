import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ErrorGameData } from "../types";
import { parsearBusqueda, parsearColeccion, parsearDetalle, puntuacionDeBgg } from "./parser";

const fixture = (nombre: string) =>
  readFileSync(new URL(`./__fixtures__/${nombre}`, import.meta.url), "utf8");

describe("parsearBusqueda", () => {
  it("lee id, nombre principal y año, sin repetir juegos", () => {
    expect(parsearBusqueda(fixture("search-catan.xml"))).toEqual([
      { id: "27710", nombre: "Catan Dice Game", anio: 2007 },
      { id: "13", nombre: "CATAN", anio: 1995 },
      { id: "278", nombre: "Catan Card Game", anio: 1996 },
      { id: "400001", nombre: "Catan & Friends: Fan Edition", anio: null },
    ]);
  });

  it("funciona con un solo resultado y con ninguno", () => {
    expect(parsearBusqueda(fixture("search-un-resultado.xml"))).toEqual([
      { id: "174430", nombre: "Gloomhaven", anio: 2017 },
    ]);
    expect(parsearBusqueda(fixture("search-vacia.xml"))).toEqual([]);
  });

  it("si el principal aparece después de un alternativo, gana el principal", () => {
    const xml = `<items><item type="boardgame" id="5"><name type="alternate" value="Alt"/></item>
      <item type="boardgame" id="5"><name type="primary" value="Principal"/></item></items>`;
    expect(parsearBusqueda(xml)).toEqual([{ id: "5", nombre: "Principal", anio: null }]);
  });

  it("falla con un error de BGG o con XML que no es de la API", () => {
    expect(() => parsearBusqueda(fixture("error.xml"))).toThrow(ErrorGameData);
    expect(() => parsearBusqueda(fixture("respuesta-202.xml"))).toThrow(ErrorGameData);
    expect(() => parsearBusqueda("<html><body>Cloudflare</body></html>")).toThrow(ErrorGameData);
  });
});

describe("parsearDetalle", () => {
  it("lee todos los campos de un juego completo", () => {
    const [catan] = parsearDetalle(fixture("thing-13.xml"));
    expect(catan).toEqual({
      bgg_id: 13,
      nombre: "CATAN",
      imagen_url: expect.stringMatching(/^https:\/\/cf\.geekdo-images\.com\/.+__original\//),
      jugadores_min: 3,
      jugadores_max: 4,
      duracion_min: 120,
      complejidad: 2.29,
      anio: 1995,
      descripcion: expect.any(String),
      tipos: ["eurogame", "negociación"],
      es_expansion: false,
      expande: [],
    });
  });

  it("una expansión trae los juegos base (links inbound), sin repetir", () => {
    const [navegantes] = parsearDetalle(fixture("thing-expansion.xml"));
    expect(navegantes).toMatchObject({
      bgg_id: 325,
      nombre: "Catan: Seafarers",
      es_expansion: true,
      expande: [13, 926],
    });
  });

  it("decodifica las entidades de la descripción y respeta los saltos de línea", () => {
    const [catan] = parsearDetalle(fixture("thing-13.xml"));
    expect(catan.descripcion).toBe(
      "In CATAN (formerly The Settlers of Catan), players try to be the dominant force on the island of Catan by building settlements, cities, and roads.\n\n" +
        'Players trade "resources" — brick, wood, wool & ore — with each other.\n\n' +
        "Café edition not included.",
    );
  });

  it("respeta párrafos y saltos simples, decodifica todo y limpia espacios y líneas de más", () => {
    const [pandemic] = parsearDetalle(fixture("thing-descripcion.xml"));
    expect(pandemic.descripcion).toBe(
      "In Pandemic, several virulent diseases have broken out simultaneously all over the world!\n\n" +
        "Each player’s role gives a unique ability – use them well:\n" +
        "• Medic\n" +
        "• Scientist\n\n" +
        'Board game designer Matt Leacock calls it "a race against time". R&D not included.',
    );
  });

  it("convierte los ceros de BGG en null y usa el thumbnail si no hay imagen", () => {
    const [juego] = parsearDetalle(fixture("thing-sin-datos.xml"));
    expect(juego).toEqual({
      bgg_id: 400001,
      nombre: "Catan & Friends: Fan Edition",
      imagen_url: "https://cf.geekdo-images.com/thumb/pic1.png",
      jugadores_min: null,
      jugadores_max: null,
      duracion_min: null,
      complejidad: null,
      anio: null,
      descripcion: null,
      tipos: ["cooperativo"],
      es_expansion: false,
      expande: [],
    });
  });

  it("devuelve [] si el id no existe", () => {
    expect(parsearDetalle(fixture("thing-vacio.xml"))).toEqual([]);
  });

  it("corrige jugadores invertidos e ignora imágenes que no son https", () => {
    const xml = `<items><item type="boardgame" id="9"><name type="primary" value="X"/>
      <image>http://inseguro.com/a.jpg</image><minplayers value="5"/><maxplayers value="2"/></item></items>`;
    expect(parsearDetalle(xml)[0]).toMatchObject({
      imagen_url: null,
      jugadores_min: 2,
      jugadores_max: 5,
    });
  });
});

describe("parsearColeccion", () => {
  it("lee los juegos, sin repetir, con la puntuación redondeada", () => {
    expect(parsearColeccion(fixture("coleccion.xml"))).toEqual([
      { bgg_id: 13, nombre: "CATAN", anio: 1995, es_expansion: false, puntuacion: 8 },
      {
        bgg_id: 822,
        nombre: "Carcassonne & Friends",
        anio: null,
        es_expansion: false,
        puntuacion: null,
      },
      { bgg_id: 30549, nombre: "Pandemic", anio: 2008, es_expansion: false, puntuacion: 10 },
    ]);
  });

  it("marca las expansiones por el subtype", () => {
    expect(parsearColeccion(fixture("coleccion-expansiones.xml"))).toEqual([
      { bgg_id: 325, nombre: "Catan: Seafarers", anio: 1997, es_expansion: true, puntuacion: 8 },
    ]);
  });

  it("un usuario que no existe es usuario_inexistente", () => {
    expect(() => parsearColeccion(fixture("coleccion-usuario-inexistente.xml"))).toThrow(
      expect.objectContaining({ codigo: "usuario_inexistente" }),
    );
  });

  it("colección vacía", () => {
    expect(parsearColeccion('<items totalitems="0"></items>')).toEqual([]);
  });
});

describe("puntuacionDeBgg", () => {
  it.each([
    ["7.5", 8],
    ["7.49", 7],
    ["10", 10],
    ["1", 1],
    ["N/A", null],
    ["0", null],
    [undefined, null],
  ])("%j → %j", (valor, esperado) => {
    expect(puntuacionDeBgg(valor)).toBe(esperado);
  });
});
