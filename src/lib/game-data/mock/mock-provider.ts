import { normalizar, ordenarPorRelevancia } from "../texto";
import {
  ErrorGameData,
  LARGO_MINIMO_BUSQUEDA,
  MAXIMO_RESULTADOS,
  type DatosJuego,
  type GameDataProvider,
  type ItemColeccion,
  type ResultadoBusqueda,
} from "../types";
import coleccionDePrueba from "./coleccion.json";
import juegos from "./juegos.json";

/** El único usuario de BGG que existe en el mock (para desarrollo y e2e). */
export const USUARIO_BGG_DE_PRUEBA = "prueba";

type JuegoMock = (typeof juegos)[number];

/**
 * Provider de prueba con ~10 juegos conocidos, para desarrollar y testear el
 * flujo de búsqueda sin depender de BGG. Los datos no tienen bgg_id (no se
 * hacen pasar por datos de BGG) ni imagen (no hace pedidos externos).
 *
 * La colección de prueba (usuario "prueba") sí necesita bgg_id para vincular
 * expansiones y evitar repetidos: usa ids desde 990.000.000, que no chocan con
 * los de BGG.
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

  async obtenerDetalles(bggIds: number[]): Promise<DatosJuego[]> {
    await this.esperar();
    return coleccionDePrueba
      .filter((j) => bggIds.includes(j.bgg_id))
      .map(({ puntuacion: _puntuacion, ...j }) => ({
        ...j,
        imagen_url: null,
        es_expansion: j.expande.length > 0,
      }));
  }

  async coleccion(usuario: string): Promise<ItemColeccion[]> {
    await this.esperar();
    if (usuario.trim().toLowerCase() !== USUARIO_BGG_DE_PRUEBA) {
      throw new ErrorGameData("usuario_inexistente", "No existe ese usuario en BoardGameGeek.");
    }
    return coleccionDePrueba.map((j) => ({
      bgg_id: j.bgg_id,
      nombre: j.nombre,
      anio: j.anio,
      es_expansion: j.expande.length > 0,
      puntuacion: j.puntuacion,
    }));
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
    es_expansion: false,
    expande: [],
  };
}
