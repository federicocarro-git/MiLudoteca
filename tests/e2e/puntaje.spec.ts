import { expect, test, type Page } from "@playwright/test";
import {
  borrarUsuario,
  crearJuego,
  crearUsuario,
  hacerAmigos,
  iniciarSesion,
  prepararPerfil,
  type Usuario,
} from "./helpers";

let ana: Usuario;
let beto: Usuario;
let juegoId: string;

test.beforeEach(async () => {
  [ana, beto] = await Promise.all([crearUsuario("ana"), crearUsuario("beto")]);
  await Promise.all([prepararPerfil(ana, "Ana"), prepararPerfil(beto, "Beto")]);
  await hacerAmigos(ana, beto);
  juegoId = await crearJuego(ana, { nombre: "Wonders casero" });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto)]);
});

// Next deja montada (oculta) la sala anterior: solo lo visible.
const visible = (page: Page) => page.locator("main").filter({ visible: true });
const casillero = (page: Page, etiqueta: string) =>
  visible(page).getByLabel(etiqueta, { exact: true });
const total = (page: Page, nombre: string, puntos: number) =>
  visible(page).getByRole("cell", { name: `Total de ${nombre}: ${puntos}` });

async function crearSala(page: Page, conBeto: boolean) {
  await page.goto(`/juegos/${juegoId}`);
  await page.getByRole("button", { name: "Jugar una partida" }).click();
  await page.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  if (conBeto) {
    await visible(page).getByRole("button", { name: "Agregar", exact: true }).click();
    const agregar = page.getByRole("dialog", { name: "Agregar jugadores" });
    await agregar.getByRole("checkbox").check();
    await agregar.getByRole("button", { name: "Agregar (1)" }).click();
    await expect(agregar).toBeHidden();
  }
}

async function elegirComoSeAnota(page: Page, opcion: RegExp, categorias?: string) {
  await visible(page).getByRole("button", { name: "Cómo se anota" }).click();
  const dialogo = page.getByRole("dialog", { name: "Cómo se anota" });
  await dialogo.getByRole("radio", { name: opcion }).check();
  if (categorias !== undefined)
    await dialogo.getByLabel("Categorías", { exact: true }).fill(categorias);
  await dialogo.getByRole("button", { name: "Listo" }).click();
  await expect(dialogo).toBeHidden();
}

test("por rondas: cada uno anota, se agregan rondas y el total se suma solo", async ({
  browser,
}) => {
  const anfitrion = await (await browser.newContext()).newPage();
  await iniciarSesion(anfitrion, ana);
  await crearSala(anfitrion, true);

  const jugador = await (await browser.newContext()).newPage();
  await iniciarSesion(jugador, beto);
  await jugador.goto("/jugar");
  await jugador.getByRole("link", { name: /Wonders casero/ }).click();
  await expect(jugador.getByText("En vivo")).toBeVisible();

  await elegirComoSeAnota(anfitrion, /Por rondas/);
  // A Beto le aparece la hoja sola.
  await expect(casillero(jugador, "Ronda 1 de Beto")).toBeVisible();
  await expect(jugador.getByRole("button", { name: "Cómo se anota" })).toHaveCount(0);

  await casillero(anfitrion, "Ronda 1 de Ana").fill("5");
  await casillero(jugador, "Ronda 1 de Beto").fill("3");
  await expect(total(anfitrion, "Beto", 3)).toBeVisible();
  await expect(total(jugador, "Ana", 5)).toBeVisible();
  // Beto no puede escribir en la columna de Ana.
  await expect(casillero(jugador, "Ronda 1 de Ana")).toHaveCount(0);

  // Beto agrega una ronda; Ana anota la de Beto (es anfitriona).
  await visible(jugador).getByRole("button", { name: "Agregar ronda" }).click();
  await expect(casillero(anfitrion, "Ronda 2 de Beto")).toBeVisible();
  await casillero(anfitrion, "Ronda 2 de Beto").fill("10");
  await expect(total(jugador, "Beto", 13)).toBeVisible();
  // Borrar un casillero lo saca del total.
  await casillero(anfitrion, "Ronda 1 de Ana").fill("");
  await expect(total(jugador, "Ana", 0)).toBeVisible();
  await casillero(anfitrion, "Ronda 1 de Ana").fill("5");
  await expect(total(jugador, "Ana", 5)).toBeVisible();

  // Con puntos ya no se cambia la forma de anotar.
  await visible(anfitrion).getByRole("button", { name: "Cómo se anota" }).click();
  await expect(anfitrion.getByText("Ya hay puntos cargados")).toBeVisible();
  await anfitrion
    .getByRole("dialog", { name: "Cómo se anota" })
    .getByRole("button", { name: "Cerrar" })
    .click();

  // Al terminar, gana el total más alto y la hoja queda en el resultado.
  await visible(anfitrion).getByRole("button", { name: "Terminar partida" }).click();
  const terminar = anfitrion.getByRole("dialog", { name: "Terminar partida" });
  await expect(terminar.getByText("Gana Beto")).toBeVisible();
  await terminar.getByRole("button", { name: "Terminar y guardar" }).click();
  await anfitrion.waitForURL(/\/partida\//);
  await expect(anfitrion.getByText("Ganó Beto")).toBeVisible();
  await expect(anfitrion.getByRole("heading", { name: "Rondas" })).toBeVisible();
  await expect(anfitrion.getByLabel("Ronda 2 de Beto: 10")).toBeVisible();
  await expect(total(anfitrion, "Beto", 13)).toBeVisible();
});

test("hoja de categorías que queda guardada para el juego", async ({ page }) => {
  await iniciarSesion(page, ana);
  await crearSala(page, false);
  await elegirComoSeAnota(page, /Hoja de puntuación/, "Militar\nCiencia\n\nciencia");

  await expect(casillero(page, "Militar de Ana")).toBeVisible();
  await expect(casillero(page, "Ciencia de Ana")).toBeVisible();
  await expect(visible(page).getByRole("rowheader")).toHaveText(["Militar", "Ciencia", "Total"]);
  await casillero(page, "Militar de Ana").fill("4");
  await casillero(page, "Ciencia de Ana").fill("9");
  await expect(total(page, "Ana", 13)).toBeVisible();
  await expect(visible(page).getByRole("button", { name: "Agregar ronda" })).toHaveCount(0);

  // Se cancela la sala y se crea otra con el mismo juego: la hoja ya está escrita.
  await visible(page).getByRole("button", { name: "Cancelar la sala" }).click();
  await page
    .getByRole("dialog", { name: "¿Cancelar la sala?" })
    .getByRole("button", { name: "Cancelar la sala" })
    .click();
  await page.waitForURL("**/jugar");
  await crearSala(page, false);
  await visible(page).getByRole("button", { name: "Cómo se anota" }).click();
  const dialogo = page.getByRole("dialog", { name: "Cómo se anota" });
  await dialogo.getByRole("radio", { name: /Hoja de puntuación/ }).check();
  await expect(dialogo.getByLabel("Categorías", { exact: true })).toHaveValue("Militar\nCiencia");
});
