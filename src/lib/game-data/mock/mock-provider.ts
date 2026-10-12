import { normalizar, ordenarPorRelevancia } from "../texto";
import {
  LARGO_MINIMO_BUSQUEDA,
  MAXIMO_RESULTADOS,
  type DatosJuego,
  type GameDataProvider,
  type ResultadoBusqueda,
} from "../types";
import juegos from "./juegos.json";

type JuegoMock = (typeof juegos)[number];

/**
 * Provider de prueba con ~10 juegos conocidos, para desarrollar y testear el
 * flujo de búsqueda sin depender de BGG. Los datos no tienen bgg_id (no se
 * hacen pasar por datos de BGG) ni imagen (no hace pedidos externos).
 */
export class MockProvider implements GameDataProvider {
  readonly id = "mock" as const;

  constructor(private readonly opciones: { latenciaMs?: number } = {}) {}

  async buscar(nombre: string): Promise<ResultadoBusqueda[]> {
    await this.esperar();
    const q = normalizar(nombre);
    if (q.length < LARGO_MINIMO_BUSQUEDA) return [];
    const encontrados = juegos
      .filter((j) => normalizar(j.nombre).includes(q))
      .map((j) => ({ id: j.id, nombre: j.nombre, anio: j.anio }));
    return ordenarPorRelevancia(encontrados, q).slice(0, MAXIMO_RESULTADOS);
  }

  async obtenerDetalle(id: string): Promise<DatosJuego | null> {
    await this.esperar();
    const juego = juegos.find((j) => j.id === id);
    return juego ? aDatosJuego(juego) : null;
  }

  private async esperar() {
    const ms = this.opciones.latenciaMs ?? 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
}

function aDatosJuego(j: JuegoMock): DatosJuego {
  return {
    bgg_id: null,
    nombre: j.nombre,
    imagen_url: null,
    jugadores_min: j.jugadores_min,
    jugadores_max: j.jugadores_max,
    duracion_min: j.duracion_min,
    complejidad: j.complejidad,
    anio: j.anio,
    descripcion: j.descripcion,
    tipos: [...j.tipos],
  };
}
