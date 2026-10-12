import { expect, test, type Page } from "@playwright/test";
import {
  borrarUsuario,
  crearJuego,
  crearUsuario,
  iniciarSesion,
  ruta,
  type Usuario,
} from "./helpers";

const JUEGOS = [
  {
    nombre: "Catán",
    jugadores_min: 3,
    jugadores_max: 4,
    duracion_min: 90,
    complejidad: 2.29,
    tipos: ["eurogame", "negociación"],
    p: 7,
  },
  {
    nombre: "Código Secreto",
    jugadores_min: 2,
    jugadores_max: 8,
    duracion_min: 15,
    complejidad: 1.27,
    tipos: ["party", "palabras"],
    p: 9,
  },
  {
    nombre: "Pandemic",
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 2.4,
    tipos: ["cooperativo"],
    p: 8,
  },
  {
    nombre: "Gloomhaven",
    jugadores_min: 1,
    jugadores_max: 4,
    duracion_min: 120,
    complejidad: 3.9,
    tipos: ["cooperativo", "temático"],
    p: 10,
  },
  {
    nombre: "Azul",
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 1.76,
    tipos: ["abstracto"],
    p: null,
  },
  {
    nombre: "Dixit",
    jugadores_min: 3,
    jugadores_max: 6,
    duracion_min: 30,
    complejidad: 1.21,
    tipos: ["party", "cartas"],
    p: 6,
  },
  {
    nombre: "Wingspan",
    jugadores_min: 1,
    jugadores_max: 5,
    duracion_min: 70,
    complejidad: 2.45,
    tipos: ["cartas", "eurogame", "solitario"],
    p: 9,
  },
  { nombre: "Juego sin datos", tipos: [], p: null },
];

let usuario: Usuario;
test.beforeEach(async ({ page }) => {
  usuario = await crearUsuario("catalogo");
  for (const [i, { p, ...juego }] of JUEGOS.entries()) {
    await crearJuego(usuario, juego, {
      puntuacion: p,
      agregado_en: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    });
  }
  await iniciarSesion(page, usuario);
  await expect(conteo(page, "8 juegos")).toBeVisible();
});
test.afterEach(() => borrarUsuario(usuario));

const conteo = (page: Page, texto: string) => page.getByText(texto, { exact: true });
const nombres = (page: Page) => page.locator("main ul.grid h3").allTextContents();

test("lista ordenada por nombre", async ({ page }) => {
  expect((await nombres(page))[0]).toBe("Azul");
  await expect(page.locator("main ul.grid > li")).toHaveCount(8);
});

test("búsqueda sin tildes, guardada en la URL", async ({ page }) => {
  await page.getByLabel("Buscar en mi catálogo").fill("catan");
  await expect(conteo(page, "1 de 8 juegos")).toBeVisible();
  expect(await nombres(page)).toEqual(["Catán"]);
  expect(ruta(page)).toBe("/catalogo?q=catan");
});

test("filtros: conteo en vivo, URL, recarga y chips", async ({ page }) => {
  // Que termine la navegación del login antes de empezar a contar.
  await page.waitForLoadState("networkidle");
  const pedidosAlCatalogo: string[] = [];
  page.on(
    "request",
    (r) => new URL(r.url()).pathname === "/catalogo" && pedidosAlCatalogo.push(r.url()),
  );

  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.getByRole("button", { name: "4 jugadores", exact: true }).click();
  await page.getByRole("button", { name: "1 h", exact: true }).click();
  await page.getByRole("button", { name: "Ver 4 juegos" }).click();
  expect(await nombres(page)).toEqual(["Azul", "Código Secreto", "Dixit", "Pandemic"]);
  expect(ruta(page)).toBe("/catalogo?jugadores=4&duracion=60");
  await expect(page.getByRole("button", { name: /Filtros 2 activos/ })).toBeVisible();
  expect(pedidosAlCatalogo, "filtrar no vuelve a pedir el catálogo").toEqual([]);

  await page.reload();
  await expect(conteo(page, "4 de 8 juegos")).toBeVisible();

  await page.getByRole("button", { name: "Hasta 1 h (quitar filtro)" }).click();
  await expect(conteo(page, "7 de 8 juegos")).toBeVisible();
});

test("sin resultados: sorteo deshabilitado y limpiar", async ({ page }) => {
  await page.goto("/catalogo?tipo=solitario&complejidad=pesado");
  await expect(page.getByText("Ningún juego coincide")).toBeVisible();
  await expect(page.getByRole("button", { name: "¿A qué jugamos?" })).toBeDisabled();
  await page.getByRole("button", { name: "Limpiar filtros y búsqueda" }).click();
  await expect(conteo(page, "8 juegos")).toBeVisible();
  expect(ruta(page)).toBe("/catalogo");
});

test("orden por puntuación y por agregados recientemente", async ({ page }) => {
  await page.getByLabel("Ordenar por").selectOption("puntuacion");
  expect((await nombres(page)).slice(0, 2)).toEqual(["Gloomhaven", "Código Secreto"]);
  await page.getByLabel("Ordenar por").selectOption("recientes");
  expect((await nombres(page))[0]).toBe("Juego sin datos");
});

test("¿A qué jugamos? sortea entre los filtrados y 'Otro' cambia", async ({ page }) => {
  await page.goto("/catalogo?tipo=cooperativo");
  await expect(conteo(page, "2 de 8 juegos")).toBeVisible();
  await page.getByRole("button", { name: "¿A qué jugamos?" }).click();
  await expect(page.getByText("Hoy se juega…")).toBeVisible();
  const primero = await page.locator("dialog p.text-2xl").textContent();
  expect(["Pandemic", "Gloomhaven"]).toContain(primero);

  await page.getByRole("button", { name: "Otro" }).click();
  await expect(page.getByText("Hoy se juega…")).toBeVisible();
  const segundo = await page.locator("dialog p.text-2xl").textContent();
  expect(segundo).not.toBe(primero);

  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(page.getByRole("heading", { name: segundo! })).toBeVisible();
});

test("el botón flotante no tapa la última tarjeta", async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const ultima = await page.locator("main ul.grid > li").last().boundingBox();
  const boton = await page.getByRole("button", { name: "¿A qué jugamos?" }).boundingBox();
  expect(ultima!.y + ultima!.height).toBeLessThanOrEqual(boton!.y);
});

test("un juego agregado aparece al volver al catálogo", async ({ page }) => {
  await page.goto("/juegos/nuevo");
  await page.getByLabel("Nombre", { exact: true }).fill("Recién agregado");
  await page.getByRole("button", { name: "Guardar en mi catálogo" }).click();
  await page.waitForURL(/agregado=1/);
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Catálogo" })
    .click();
  await expect(conteo(page, "9 juegos")).toBeVisible();
});

test("otro usuario ve su catálogo vacío", async ({ page }) => {
  const otro = await crearUsuario("vacio");
  await page.context().clearCookies();
  await iniciarSesion(page, otro);
  await expect(page.getByText("Todavía no agregaste juegos")).toBeVisible();
  await borrarUsuario(otro);
});
