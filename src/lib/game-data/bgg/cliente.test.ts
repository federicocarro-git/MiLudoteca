import { describe, expect, it, vi } from "vitest";
import { ErrorGameData } from "../types";
import { ClienteBgg, leerRetryAfter } from "./cliente";

const XML_OK = "<items></items>";

/** fetch simulado que devuelve, en orden, las respuestas indicadas. */
function fetchCon(...respuestas: Array<Response | Error>) {
  const fn = vi.fn<typeof fetch>();
  for (const r of respuestas) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  return fn;
}

const respuesta = (status: number, headers: Record<string, string> = {}, body = "") =>
  new Response(status === 204 ? null : body, { status, headers });

function crear(fetchMock: ReturnType<typeof fetchCon>, extra = {}) {
  const esperas: number[] = [];
  const cliente = new ClienteBgg({
    token: "tok-123",
    fetch: fetchMock,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    ...extra,
  });
  return { cliente, esperas };
}

describe("ClienteBgg", () => {
  it("pega al dominio sin www, con el token como Bearer", async () => {
    const f = fetchCon(respuesta(200, {}, XML_OK));
    const { cliente } = crear(f);
    expect(await cliente.pedir("search", { query: "catan & co", type: "boardgame" })).toBe(XML_OK);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://boardgamegeek.com/xmlapi2/search?query=catan+%26+co&type=boardgame");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok-123");
  });

  it("reintenta los 202 con backoff exponencial", async () => {
    const f = fetchCon(respuesta(202), respuesta(202), respuesta(200, {}, XML_OK));
    const { cliente, esperas } = crear(f);
    expect(await cliente.pedir("thing", { id: "13" })).toBe(XML_OK);
    expect(f).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([1000, 2000]);
  });

  it("ante un 429 espera lo que indica Retry-After", async () => {
    const f = fetchCon(respuesta(429, { "Retry-After": "3" }), respuesta(200, {}, XML_OK));
    const { cliente, esperas } = crear(f);
    expect(await cliente.pedir("thing", { id: "13" })).toBe(XML_OK);
    expect(esperas).toEqual([3000]);
  });

  it("ante un 429 sin Retry-After usa un backoff más largo", async () => {
    const f = fetchCon(respuesta(429), respuesta(429), respuesta(200, {}, XML_OK));
    const { cliente, esperas } = crear(f);
    await cliente.pedir("thing", { id: "13" });
    expect(esperas).toEqual([2000, 4000]);
  });

  it("si Retry-After pide esperar demasiado, corta sin esperar", async () => {
    const f = fetchCon(respuesta(429, { "Retry-After": "120" }));
    const { cliente, esperas } = crear(f);
    await expect(cliente.pedir("thing", { id: "13" })).rejects.toMatchObject({
      codigo: "limite_de_pedidos",
    });
    expect(esperas).toEqual([]);
  });

  it("se rinde después de maxIntentos, sin esperar después del último", async () => {
    const f = fetchCon(respuesta(202), respuesta(202), respuesta(202));
    const { cliente, esperas } = crear(f, { maxIntentos: 3 });
    await expect(cliente.pedir("thing", { id: "13" })).rejects.toMatchObject({
      codigo: "no_disponible",
    });
    expect(f).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([1000, 2000]);
  });

  it("limita cada espera a esperaMaximaMs", async () => {
    const f = fetchCon(respuesta(503), respuesta(503), respuesta(200, {}, XML_OK));
    const { cliente, esperas } = crear(f, { esperaBaseMs: 10000, esperaMaximaMs: 12000 });
    await cliente.pedir("thing", { id: "13" });
    expect(esperas).toEqual([10000, 12000]);
  });

  it("reintenta errores de red y 5xx", async () => {
    const f = fetchCon(new TypeError("fetch failed"), respuesta(502), respuesta(200, {}, XML_OK));
    const { cliente } = crear(f);
    expect(await cliente.pedir("thing", { id: "13" })).toBe(XML_OK);
  });

  it.each([401, 403])("no reintenta un %i (token inválido)", async (status) => {
    const f = fetchCon(respuesta(status));
    const { cliente } = crear(f);
    await expect(cliente.pedir("thing", { id: "13" })).rejects.toMatchObject({
      codigo: "no_autorizado",
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("otros estados son un error sin reintento", async () => {
    const f = fetchCon(respuesta(404));
    const { cliente } = crear(f);
    await expect(cliente.pedir("thing", { id: "13" })).rejects.toBeInstanceOf(ErrorGameData);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("exige token", () => {
    expect(() => new ClienteBgg({ token: "" })).toThrow();
  });
});

describe("leerRetryAfter", () => {
  it("acepta segundos y fechas HTTP", () => {
    expect(leerRetryAfter("5")).toBe(5000);
    const ahora = Date.parse("2026-10-12T10:00:00Z");
    expect(leerRetryAfter("Mon, 12 Oct 2026 10:00:30 GMT", ahora)).toBe(30000);
    expect(leerRetryAfter("Mon, 12 Oct 2026 09:00:00 GMT", ahora)).toBe(0);
  });

  it("ignora valores vacíos o inválidos", () => {
    expect(leerRetryAfter(null)).toBeNull();
    expect(leerRetryAfter("pronto")).toBeNull();
  });
});
