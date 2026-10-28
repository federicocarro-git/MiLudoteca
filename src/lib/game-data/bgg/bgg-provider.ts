import { ordenarPorRelevancia } from "../texto";
import {
  LARGO_MINIMO_BUSQUEDA,
  MAXIMO_RESULTADOS,
  type DatosJuego,
  type GameDataProvider,
  type ItemColeccion,
  type ResultadoBusqueda,
} from "../types";
import type { ClienteBgg } from "./cliente";
import { parsearBusqueda, parsearColeccion, parsearDetalle } from "./parser";

/** Cache de detalles de BGG (en producción, las filas `origen = 'bgg'` de `juegos`). */
export interface CacheJuegosBgg {
  obtener(bggId: number): Promise<{ datos: DatosJuego; sincronizadoEn: Date } | null>;
  guardar(datos: DatosJuego, sincronizadoEn: Date): Promise<void>;
}

export const VIGENCIA_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
/** Ids por pedido a `thing` (verificado con la API real). */
export const IDS_POR_PEDIDO = 20;
/** `collection` puede tardar en armarse (BGG responde 202 mientras tanto). */
const INTENTOS_COLECCION = 6;

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

  /** Varios a la vez: primero la cache y lo que falta, de a 20 por pedido. */
  async obtenerDetalles(bggIds: number[]): Promise<DatosJuego[]> {
    const ids = [...new Set(bggIds.filter((id) => Number.isInteger(id) && id > 0))];
    const ahora = this.deps.ahora?.() ?? new Date();
    const encontrados = new Map<number, DatosJuego>();
    const viejos = new Map<number, DatosJuego>();

    for (const id of ids) {
      const cacheado = await this.leerCache(id);
      if (!cacheado) continue;
      if (ahora.getTime() - cacheado.sincronizadoEn.getTime() < VIGENCIA_CACHE_MS) {
        encontrados.set(id, cacheado.datos);
      } else {
        viejos.set(id, cacheado.datos);
      }
    }

    const faltan = ids.filter((id) => !encontrados.has(id));
    for (let i = 0; i < faltan.length; i += IDS_POR_PEDIDO) {
      const lote = faltan.slice(i, i + IDS_POR_PEDIDO);
      let datos: DatosJuego[];
      try {
        const xml = await this.deps.cliente.pedir("thing", { id: lote.join(","), stats: "1" });
        datos = parsearDetalle(xml);
      } catch (error) {
        // Sin BGG, lo que haya en la cache (aunque esté vieja); si no hay nada, error.
        const copias = lote.flatMap((id) => viejos.get(id) ?? []);
        if (copias.length === 0) throw error;
        for (const d of copias) encontrados.set(d.bgg_id!, d);
        continue;
      }
      for (const d of datos) {
        if (!d.bgg_id || !lote.includes(d.bgg_id)) continue;
        encontrados.set(d.bgg_id, d);
        await this.deps.cache.guardar(d, ahora).catch((error) => this.registrar("guardar", error));
      }
    }
    return ids.flatMap((id) => encontrados.get(id) ?? []);
  }

  /**
   * Lo que el usuario marcó como "Own" en BGG. Dos pedidos: con
   * `subtype=boardgame` BGG también devuelve las expansiones (marcadas como
   * juegos), así que los juegos se piden sin expansiones y las expansiones,
   * aparte.
   */
  async coleccion(usuario: string): Promise<ItemColeccion[]> {
    const base = { username: usuario.trim(), own: "1", stats: "1" };
    const opciones = { maxIntentos: INTENTOS_COLECCION };
    const juegos = parsearColeccion(
      await this.deps.cliente.pedir(
        "collection",
        { ...base, subtype: "boardgame", excludesubtype: "boardgameexpansion" },
        opciones,
      ),
    );
    const expansiones = parsearColeccion(
      await this.deps.cliente.pedir(
        "collection",
        { ...base, subtype: "boardgameexpansion" },
        opciones,
      ),
    ).map((e) => ({ ...e, es_expansion: true }));
    const vistos = new Set(juegos.map((j) => j.bgg_id));
    return [...juegos, ...expansiones.filter((e) => !vistos.has(e.bgg_id))];
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
