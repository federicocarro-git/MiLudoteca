import { ErrorGameData } from "../types";

// Cliente HTTP de la XML API2 de BGG. Solo se usa desde el servidor.
// Verificado con la API real: ver la checklist en CLAUDE.md.

export const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";

export type OpcionesClienteBgg = {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Inyectable para que los tests no esperen de verdad. */
  esperar?: (ms: number) => Promise<void>;
  /** Intentos totales por pedido (el primero + reintentos). */
  maxIntentos?: number;
  /** Espera base del backoff exponencial, en ms. */
  esperaBaseMs?: number;
  /** Si BGG pide esperar más que esto (Retry-After), se corta. */
  esperaMaximaMs?: number;
  timeoutMs?: number;
};

const esperarDeVerdad = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ClienteBgg {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly maxIntentos: number;
  private readonly esperaBaseMs: number;
  private readonly esperaMaximaMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly opciones: OpcionesClienteBgg) {
    if (!opciones.token) throw new Error("Falta el token de BGG.");
    this.baseUrl = opciones.baseUrl ?? BGG_BASE_URL;
    this.fetch = opciones.fetch ?? globalThis.fetch.bind(globalThis);
    this.esperar = opciones.esperar ?? esperarDeVerdad;
    this.maxIntentos = opciones.maxIntentos ?? 4;
    this.esperaBaseMs = opciones.esperaBaseMs ?? 1000;
    this.esperaMaximaMs = opciones.esperaMaximaMs ?? 15000;
    this.timeoutMs = opciones.timeoutMs ?? 10000;
  }

  /**
   * GET a un endpoint (`search`, `thing`, ...) y devuelve el XML.
   * - 200: listo.
   * - 202: BGG encoló el pedido; se reintenta con backoff.
   * - 429: se espera lo que diga Retry-After (o backoff) y se reintenta.
   * - 5xx o error de red: se reintenta con backoff.
   * - 401/403: token inválido; no se reintenta.
   */
  async pedir(
    endpoint: string,
    params: Record<string, string>,
    /** `collection` suele tardar más en armarse: se le dan más intentos. */
    opciones: { maxIntentos?: number } = {},
  ): Promise<string> {
    const url = `${this.baseUrl}/${endpoint}?${new URLSearchParams(params)}`;
    const maxIntentos = opciones.maxIntentos ?? this.maxIntentos;
    let ultimoError: ErrorGameData | null = null;

    for (let intento = 0; intento < maxIntentos; intento++) {
      const backoff = this.esperaBaseMs * 2 ** intento;
      let respuesta: Response;
      try {
        respuesta = await this.fetch(url, {
          headers: {
            Authorization: `Bearer ${this.opciones.token}`,
            Accept: "application/xml, text/xml",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        ultimoError = new ErrorGameData("no_disponible", "No se pudo conectar con BGG.");
        await this.esperarSiQuedanIntentos(intento, maxIntentos, backoff);
        continue;
      }

      if (respuesta.status === 200) return respuesta.text();

      // Liberar el cuerpo de las respuestas que no usamos.
      await respuesta.body?.cancel().catch(() => {});

      if (respuesta.status === 401 || respuesta.status === 403) {
        throw new ErrorGameData("no_autorizado", "BGG rechazó el token de acceso.");
      }

      if (respuesta.status === 202) {
        ultimoError = new ErrorGameData(
          "no_disponible",
          "BGG todavía está preparando la respuesta.",
        );
        await this.esperarSiQuedanIntentos(intento, maxIntentos, backoff);
        continue;
      }

      if (respuesta.status === 429) {
        ultimoError = new ErrorGameData(
          "limite_de_pedidos",
          "BGG está recibiendo demasiados pedidos. Probá en un rato.",
        );
        const pedida = leerRetryAfter(respuesta.headers.get("retry-after"));
        if (pedida !== null && pedida > this.esperaMaximaMs) throw ultimoError;
        await this.esperarSiQuedanIntentos(intento, maxIntentos, pedida ?? backoff * 2);
        continue;
      }

      if (respuesta.status >= 500) {
        ultimoError = new ErrorGameData("no_disponible", "BGG no está disponible en este momento.");
        await this.esperarSiQuedanIntentos(intento, maxIntentos, backoff);
        continue;
      }

      throw new ErrorGameData(
        "respuesta_invalida",
        `BGG respondió con un estado inesperado (${respuesta.status}).`,
      );
    }

    throw ultimoError ?? new ErrorGameData("no_disponible", "No se pudo consultar BGG.");
  }

  private async esperarSiQuedanIntentos(intento: number, maxIntentos: number, ms: number) {
    if (intento < maxIntentos - 1) await this.esperar(Math.min(ms, this.esperaMaximaMs));
  }
}

/** Retry-After puede venir en segundos o como fecha HTTP. Devuelve ms. */
export function leerRetryAfter(valor: string | null, ahora = Date.now()): number | null {
  if (!valor) return null;
  const segundos = Number(valor.trim());
  if (Number.isFinite(segundos) && segundos >= 0) return segundos * 1000;
  const fecha = Date.parse(valor);
  if (Number.isNaN(fecha)) return null;
  return Math.max(0, fecha - ahora);
}
