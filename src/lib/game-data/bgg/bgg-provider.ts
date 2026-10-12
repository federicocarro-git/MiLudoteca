import { ordenarPorRelevancia } from "../texto";
import {
  LARGO_MINIMO_BUSQUEDA,
  MAXIMO_RESULTADOS,
  type DatosJuego,
  type GameDataProvider,
  type ResultadoBusqueda,
} from "../types";
import type { ClienteBgg } from "./cliente";
import { parsearBusqueda, parsearDetalle } from "./parser";

/** Cache de detalles de BGG (en producción, las filas `origen = 'bgg'` de `juegos`). */
export interface CacheJuegosBgg {
  obtener(bggId: number): Promise<{ datos: DatosJuego; sincronizadoEn: Date } | null>;
  guardar(datos: DatosJuego, sincronizadoEn: Date): Promise<void>;
}

export const VIGENCIA_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export class BggProvider implements GameDataProvider {
  readonly id = "bgg" as const;

  constructor(
    private readonly deps: {
      cliente: Pick<ClienteBgg, "pedir">;
      cache: CacheJuegosBgg;
      ahora?: () => Date;
      /** Para registrar fallas de la cache sin cortar el flujo. */
      log?: (mensaje: string, error: unknown) => void;
    },
  ) {}

  async buscar(nombre: string): Promise<ResultadoBusqueda[]> {
    const consulta = nombre.trim();
    if (consulta.length < LARGO_MINIMO_BUSQUEDA) return [];
    const xml = await this.deps.cliente.pedir("search", { query: consulta, type: "boardgame" });
    return ordenarPorRelevancia(parsearBusqueda(xml), consulta).slice(0, MAXIMO_RESULTADOS);
  }

  async obtenerDetalle(id: string): Promise<DatosJuego | null> {
    if (!/^\d{1,9}$/.test(id)) return null;
    const bggId = Number(id);
    const ahora = this.deps.ahora?.() ?? new Date();

    const cacheado = await this.leerCache(bggId);
    if (cacheado && ahora.getTime() - cacheado.sincronizadoEn.getTime() < VIGENCIA_CACHE_MS) {
      return cacheado.datos;
    }

    let datos: DatosJuego | null;
    try {
      const xml = await this.deps.cliente.pedir("thing", { id: String(bggId), stats: "1" });
      datos = parsearDetalle(xml).find((d) => d.bgg_id === bggId) ?? null;
    } catch (error) {
      // Si BGG falla pero hay una copia vieja, mejor eso que nada.
      if (cacheado) return cacheado.datos;
      throw error;
    }

    if (datos) {
      await this.deps.cache
        .guardar(datos, ahora)
        .catch((error) => this.registrar("guardar", error));
    }
    return datos;
  }

  private async leerCache(bggId: number) {
    try {
      return await this.deps.cache.obtener(bggId);
    } catch (error) {
      this.registrar("leer", error);
      return null;
    }
  }

  private registrar(accion: string, error: unknown) {
    (this.deps.log ?? console.error)(`No se pudo ${accion} la cache de BGG`, error);
  }
}
