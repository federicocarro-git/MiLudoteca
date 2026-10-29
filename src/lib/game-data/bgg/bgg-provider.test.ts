import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { DatosJuego } from "../types";
import { ErrorGameData } from "../types";
import { BggProvider, VIGENCIA_CACHE_MS, type CacheJuegosBgg } from "./bgg-provider";

const fixture = (nombre: string) =>
  readFileSync(new URL(`./__fixtures__/${nombre}`, import.meta.url), "utf8");

const AHORA = new Date("2026-10-12T12:00:00Z");

class CacheEnMemoria implements CacheJuegosBgg {
  filas = new Map<number, { datos: DatosJuego; sincronizadoEn: Date }>();
  guardar = vi.fn(async (datos: DatosJuego, sincronizadoEn: Date) => {
    this.filas.set(datos.bgg_id!, { datos, sincronizadoEn });
  });
  obtener = vi.fn(async (id: number) => this.filas.get(id) ?? null);
}

function crear(respuestas: Record<string, string | Error>) {
  const pedir = vi.fn(async (endpoint: string, params: Record<string, string>) => {
    const clave =
      endpoint === "thing"
        ? `thing:${params.id}`
        : endpoint === "collection"
          ? `collection:${params.subtype}`
          : endpoint;
    const r = respuestas[clave];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`pedido inesperado: ${clave}`);
    return r;
  });
  const cache = new CacheEnMemoria();
  const log = vi.fn();
  const provider = new BggProvider({ cliente: { pedir }, cache, ahora: () => AHORA, log });
  return { provider, pedir, cache, log };
}

describe("BggProvider.buscar", () => {
  it("busca juegos de mesa y ordena por relevancia", async () => {
    const { provider, pedir } = crear({ search: fixture("search-catan.xml") });
    const r = await provider.buscar("  catan ");
    expect(pedir).toHaveBeenCalledWith("search", { query: "catan", type: "boardgame" });
    expect(r.map((x) => x.nombre)).toEqual([
      "CATAN",
      "Catan Dice Game",
      "Catan Card Game",
      "Catan & Friends: Fan Edition",
    ]);
  });

  it("no consulta BGG con menos de 2 caracteres", async () => {
    const { provider, pedir } = crear({});
    expect(await provider.buscar("c")).toEqual([]);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("propaga los errores de BGG", async () => {
    const { provider } = crear({ search: new ErrorGameData("limite_de_pedidos", "x") });
    await expect(provider.buscar("catan")).rejects.toMatchObject({ codigo: "limite_de_pedidos" });
  });
});

describe("BggProvider.obtenerDetalle", () => {
  it("sin cache: pide a BGG con estadísticas y guarda en la cache", async () => {
    const { provider, pedir, cache } = crear({ "thing:13": fixture("thing-13.xml") });
    const d = await provider.obtenerDetalle("13");
    expect(pedir).toHaveBeenCalledWith("thing", { id: "13", stats: "1" });
    expect(d).toMatchObject({ bgg_id: 13, nombre: "CATAN", complejidad: 2.29 });
    expect(cache.guardar).toHaveBeenCalledWith(d, AHORA);
  });

  it("con cache vigente no llama a BGG", async () => {
    const { provider, pedir, cache } = crear({});
    const datos = { bgg_id: 13, nombre: "Catan cacheado" } as DatosJuego;
    cache.filas.set(13, { datos, sincronizadoEn: new Date(AHORA.getTime() - 1000) });
    expect(await provider.obtenerDetalle("13")).toBe(datos);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("con cache vencida (más de 30 días) vuelve a pedir y actualiza", async () => {
    const { provider, pedir, cache } = crear({ "thing:13": fixture("thing-13.xml") });
    cache.filas.set(13, {
      datos: { bgg_id: 13, nombre: "viejo" } as DatosJuego,
      sincronizadoEn: new Date(AHORA.getTime() - VIGENCIA_CACHE_MS - 1),
    });
    expect((await provider.obtenerDetalle("13"))?.nombre).toBe("CATAN");
    expect(pedir).toHaveBeenCalledOnce();
    expect(cache.filas.get(13)?.sincronizadoEn).toEqual(AHORA);
  });

  it("si BGG falla y hay una copia vencida, devuelve la copia", async () => {
    const { provider, cache } = crear({ "thing:13": new ErrorGameData("no_disponible", "x") });
    const datos = { bgg_id: 13, nombre: "viejo" } as DatosJuego;
    cache.filas.set(13, { datos, sincronizadoEn: new Date(0) });
    expect(await provider.obtenerDetalle("13")).toBe(datos);
  });

  it("si BGG falla y no hay copia, propaga el error", async () => {
    const { provider } = crear({ "thing:13": new ErrorGameData("no_disponible", "x") });
    await expect(provider.obtenerDetalle("13")).rejects.toBeInstanceOf(ErrorGameData);
  });

  it("un id inexistente devuelve null y no guarda nada", async () => {
    const { provider, cache } = crear({ "thing:999": fixture("thing-vacio.xml") });
    expect(await provider.obtenerDetalle("999")).toBeNull();
    expect(cache.guardar).not.toHaveBeenCalled();
  });

  it.each(["", "abc", "13; drop", "-1", "1234567890"])(
    "id inválido %j → null sin pedir",
    async (id) => {
      const { provider, pedir } = crear({});
      expect(await provider.obtenerDetalle(id)).toBeNull();
      expect(pedir).not.toHaveBeenCalled();
    },
  );

  it("si la cache falla (leer o guardar), igual devuelve los datos de BGG", async () => {
    const { provider, cache, log } = crear({ "thing:13": fixture("thing-13.xml") });
    cache.obtener.mockRejectedValueOnce(new Error("db caída"));
    cache.guardar.mockRejectedValueOnce(new Error("db caída"));
    expect((await provider.obtenerDetalle("13"))?.nombre).toBe("CATAN");
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("BggProvider.obtenerDetalles", () => {
  it("usa la cache vigente y pide el resto de una vez", async () => {
    const { provider, pedir, cache } = crear({ "thing:13,325": fixture("thing-13.xml") });
    cache.filas.set(822, {
      datos: { nombre: "Carcassonne", bgg_id: 822 } as DatosJuego,
      sincronizadoEn: AHORA,
    });
    const datos = await provider.obtenerDetalles([822, 13, 325, 13]);
    expect(pedir).toHaveBeenCalledWith("thing", { id: "13,325", stats: "1" });
    // 325 no vino en la respuesta: no aparece.
    expect(datos.map((d) => d.bgg_id)).toEqual([822, 13]);
    expect(cache.guardar).toHaveBeenCalledOnce();
  });

  it("pide de a 20 ids", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    const { provider, pedir } = crear({
      [`thing:${ids.slice(0, 20).join(",")}`]: "<items></items>",
      [`thing:${ids.slice(20).join(",")}`]: "<items></items>",
    });
    await provider.obtenerDetalles(ids);
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("si BGG falla, usa la copia vencida; sin copia, propaga el error", async () => {
    const falla = new ErrorGameData("no_disponible", "caído");
    const { provider, cache } = crear({ "thing:13": falla });
    await expect(provider.obtenerDetalles([13])).rejects.toBe(falla);
    cache.filas.set(13, {
      datos: { nombre: "Viejo", bgg_id: 13 } as DatosJuego,
      sincronizadoEn: new Date(AHORA.getTime() - VIGENCIA_CACHE_MS - 1),
    });
    expect((await provider.obtenerDetalles([13]))[0].nombre).toBe("Viejo");
  });
});

describe("BggProvider.coleccion", () => {
  it("pide juegos y expansiones por separado y los junta", async () => {
    const { provider, pedir } = crear({
      "collection:boardgame": fixture("coleccion.xml"),
      "collection:boardgameexpansion": fixture("coleccion-expansiones.xml"),
    });
    const items = await provider.coleccion(" fede ");
    expect(pedir).toHaveBeenCalledWith(
      "collection",
      {
        username: "fede",
        own: "1",
        stats: "1",
        subtype: "boardgame",
        excludesubtype: "boardgameexpansion",
      },
      { maxIntentos: 6 },
    );
    expect(items.map((i) => [i.bgg_id, i.es_expansion])).toEqual([
      [13, false],
      [822, false],
      [30549, false],
      [325, true],
    ]);
  });

  it("un usuario que no existe corta con usuario_inexistente", async () => {
    const { provider } = crear({
      "collection:boardgame": fixture("coleccion-usuario-inexistente.xml"),
    });
    await expect(provider.coleccion("nadie")).rejects.toMatchObject({
      codigo: "usuario_inexistente",
    });
  });
});
