import { describe, expect, it } from "vitest";
import { TIPOS } from "../tipos";
import { MockProvider } from "./mock-provider";
import juegos from "./juegos.json";

const provider = new MockProvider();

describe("MockProvider", () => {
  it("tiene unos 10 juegos con datos válidos", () => {
    expect(juegos.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(juegos.map((j) => j.id));
    expect(ids.size).toBe(juegos.length);
    for (const j of juegos) {
      expect(j.jugadores_min).toBeLessThanOrEqual(j.jugadores_max);
      expect(j.complejidad).toBeGreaterThanOrEqual(1);
      expect(j.complejidad).toBeLessThanOrEqual(5);
      for (const t of j.tipos) expect(TIPOS).toContain(t);
    }
  });

  it("busca sin distinguir mayúsculas ni tildes, con el exacto primero", async () => {
    const r = await provider.buscar("CATÁN");
    expect(r.map((x) => x.nombre)).toEqual(["Catan", "Catan Junior"]);
    expect(r[0]).toEqual({ id: "mock-catan", nombre: "Catan", anio: 1995 });
  });

  it("encuentra por parte del nombre", async () => {
    expect((await provider.buscar("tren")).map((x) => x.id)).toEqual(["mock-ticket-to-ride"]);
  });

  it("devuelve [] con consultas muy cortas o sin coincidencias", async () => {
    expect(await provider.buscar(" c ")).toEqual([]);
    expect(await provider.buscar("zzzz")).toEqual([]);
  });

  it("obtiene el detalle completo, sin bgg_id ni imagen", async () => {
    const d = await provider.obtenerDetalle("mock-pandemic");
    expect(d).toMatchObject({
      nombre: "Pandemic",
      bgg_id: null,
      imagen_url: null,
      jugadores_min: 2,
      jugadores_max: 4,
      tipos: ["cooperativo"],
    });
  });

  it("devuelve null para ids desconocidos", async () => {
    expect(await provider.obtenerDetalle("no-existe")).toBeNull();
  });

  it("devuelve copias: modificar el resultado no altera los datos", async () => {
    const d = await provider.obtenerDetalle("mock-azul");
    d!.tipos.push("legacy");
    expect((await provider.obtenerDetalle("mock-azul"))!.tipos).not.toContain("legacy");
  });
});
