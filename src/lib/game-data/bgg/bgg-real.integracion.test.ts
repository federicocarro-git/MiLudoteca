import { describe, expect, it } from "vitest";
import { parsearBusqueda, parsearColeccion, parsearDetalle, parsearPartidas } from "./parser";
import { BGG_BASE_URL, ClienteBgg } from "./cliente";

// Verifica la checklist "Verificación con la API real" de CLAUDE.md.
// Uso: BGG_API_TOKEN=... npm run test:bgg-real
// Imprime lo observado (códigos, headers) para completar la checklist.
// Con BGG_USUARIO=... también lee la colección de ese usuario.
const token = process.env.BGG_API_TOKEN?.trim();
const habilitado = process.env.BGG_REAL === "1" && Boolean(token);

describe.skipIf(!habilitado)("API real de BGG", { timeout: 60_000 }, () => {
  // Se crea recién al usarlo: el cuerpo del describe corre aunque esté salteado.
  const cliente = () => new ClienteBgg({ token: token! });

  it("el dominio sin www responde sin redirigir", async () => {
    const r = await fetch(`${BGG_BASE_URL}/thing?id=13`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    console.info("thing sin www →", r.status, r.headers.get("location") ?? "(sin redirect)");
    expect([200, 202]).toContain(r.status);
  });

  it("sin token o con token inválido responde con error", async () => {
    const sin = await fetch(`${BGG_BASE_URL}/thing?id=13`);
    const malo = await fetch(`${BGG_BASE_URL}/thing?id=13`, {
      headers: { Authorization: "Bearer token-invalido" },
    });
    console.info("sin token →", sin.status, (await sin.text()).slice(0, 200));
    console.info("token inválido →", malo.status, (await malo.text()).slice(0, 200));
    expect(sin.status).not.toBe(200);
  });

  it("search devuelve CATAN (id 13) y el parser lo entiende", async () => {
    const xml = await cliente().pedir("search", { query: "catan", type: "boardgame" });
    const resultados = parsearBusqueda(xml);
    console.info(
      "search catan →",
      resultados.length,
      "resultados; primeros:",
      resultados.slice(0, 3),
    );
    expect(resultados.some((r) => r.id === "13")).toBe(true);
  });

  it("thing 13 con stats tiene todos los campos esperados", async () => {
    const xml = await cliente().pedir("thing", { id: "13", stats: "1" });
    const [catan] = parsearDetalle(xml);
    console.info("thing 13 →", { ...catan, descripcion: catan?.descripcion?.slice(0, 120) });
    expect(catan).toMatchObject({ bgg_id: 13, anio: 1995, jugadores_min: 3, jugadores_max: 4 });
    expect(catan.complejidad).toBeGreaterThan(1);
    expect(catan.imagen_url).toMatch(/^https:\/\/cf\.geekdo-images\.com\//);
    expect(catan.descripcion).not.toMatch(/&#\d+;|&[a-z]+;/);
  });

  it("thing 13 con versions: encuesta de jugadores, otros nombres y caja en español", async () => {
    const xml = await cliente().pedir("thing", { id: "13", stats: "1", versions: "1" });
    const [catan] = parsearDetalle(xml);
    console.info("thing 13 (versions) →", {
      jugadores_mejor: catan.jugadores_mejor,
      jugadores_recomendados: catan.jugadores_recomendados,
      nombres_alternativos: catan.nombres_alternativos.slice(0, 15),
      imagen_es: catan.imagen_es,
      kb: Math.round(xml.length / 1024),
    });
    expect(catan.jugadores_recomendados).toContain(4);
    expect(catan.nombres_alternativos.length).toBeGreaterThan(0);
    expect(catan.imagen_es).toMatch(/^https:\/\//);
  });

  it("thing acepta 20 ids en un pedido", async () => {
    const ids = [13, 822, 30549, 68448, 36218, 9209, 230802, 266192, 148228, 70323];
    const veinte = [...ids, ...ids.map((i) => i + 1)].join(",");
    const xml = await cliente().pedir("thing", { id: veinte });
    console.info("thing con 20 ids →", parsearDetalle(xml).length, "juegos");
  });

  it("una expansión (Seafarers, 325) apunta a Catan (13) con un link inbound", async () => {
    const xml = await cliente().pedir("thing", { id: "325", stats: "1" });
    const [navegantes] = parsearDetalle(xml);
    console.info("thing 325 →", {
      nombre: navegantes?.nombre,
      es_expansion: navegantes?.es_expansion,
      expande: navegantes?.expande,
    });
    expect(navegantes.es_expansion).toBe(true);
    expect(navegantes.expande).toContain(13);
  });

  it.skipIf(!process.env.BGG_USUARIO)("lee la colección de BGG_USUARIO", async () => {
    const usuario = process.env.BGG_USUARIO!;
    const pedir = (subtype: string, extra: Record<string, string> = {}) =>
      cliente().pedir(
        "collection",
        { username: usuario, own: "1", stats: "1", subtype, ...extra },
        { maxIntentos: 6 },
      );
    const juegos = parsearColeccion(
      await pedir("boardgame", { excludesubtype: "boardgameexpansion" }),
    );
    const expansiones = parsearColeccion(await pedir("boardgameexpansion"));
    console.info(
      `colección de ${usuario} →`,
      juegos.length,
      "juegos y",
      expansiones.length,
      "expansiones; primeros:",
      [...juegos.slice(0, 3), ...expansiones.slice(0, 2)],
    );
    expect(juegos.every((j) => !j.es_expansion)).toBe(true);
  });

  it.skipIf(!process.env.BGG_USUARIO)("lee las partidas de BGG_USUARIO", async () => {
    const xml = await cliente().pedir(
      "plays",
      { username: process.env.BGG_USUARIO!, page: "1" },
      { maxIntentos: 6 },
    );
    const { total, partidas } = parsearPartidas(xml);
    console.info(
      `partidas de ${process.env.BGG_USUARIO} →`,
      total,
      "en total; primeras:",
      JSON.stringify(partidas.slice(0, 2), null, 1),
    );
    expect(total).toBeGreaterThanOrEqual(partidas.length);
  });
});
