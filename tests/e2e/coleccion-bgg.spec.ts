import { expect, test } from "@playwright/test";
import {
  borrarJuegosBgg,
  borrarUsuario,
  crearUsuario,
  iniciarSesion,
  type Usuario,
} from "./helpers";

// La colección de prueba del MockProvider (usuario "prueba"): Catan y
// Carcassonne con una expansión cada uno, y una expansión de un juego que no
// está en la colección. Comparte filas de BGG: no correr en paralelo.
const IDS_BGG = [990000013, 990000822, 990000325, 990000002, 990031627];

test.describe.configure({ mode: "serial" });

let ana: Usuario;
test.beforeEach(async () => {
  await borrarJuegosBgg(...IDS_BGG);
  ana = await crearUsuario("ana");
});
test.afterEach(async () => {
  await borrarUsuario(ana);
  await borrarJuegosBgg(...IDS_BGG);
});

test("vincular BGG, importar la colección y ver las expansiones en su juego", async ({ page }) => {
  await iniciarSesion(page, ana);
  await page.goto("/cuenta");
  await page.waitForLoadState("networkidle");
  const bgg = page.getByRole("region", { name: "BoardGameGeek" });

  // Un usuario que no existe en BGG avisa al importar.
  await bgg.getByLabel("Tu usuario de BGG").fill("nadie");
  await bgg.getByRole("button", { name: "Vincular" }).click();
  await expect(bgg.getByText("Vinculada con nadie")).toBeVisible();
  await bgg.getByRole("button", { name: "Traer mis juegos" }).click();
  await expect(bgg.getByText('No existe el usuario "nadie" en BoardGameGeek.')).toBeVisible();

  // Se desvincula y se vincula el bueno.
  await bgg.getByRole("button", { name: "Desvincular" }).click();
  await bgg.getByLabel("Tu usuario de BGG").fill("prueba");
  await bgg.getByRole("button", { name: "Vincular" }).click();
  await bgg.getByRole("button", { name: "Traer mis juegos" }).click();
  await expect(bgg.getByText("¡Listo! Agregaste 2 juegos y 3 expansiones.")).toBeVisible();
  await expect(bgg.getByText(/última importación/)).toBeVisible();

  // En el estante, las expansiones van adentro de su juego.
  await bgg.getByRole("link", { name: "Ver tu estante" }).click();
  await page.waitForURL("**/catalogo");
  await expect(page.getByText("3 juegos", { exact: true })).toBeVisible();
  const catan = page.getByRole("link", { name: /Catan/ });
  await expect(catan).toContainText("+1 expansión");
  await expect(page.getByRole("link", { name: /Europa 1912/ })).toContainText("Expansión");
  await expect(page.getByRole("link", { name: /Navegantes/ })).toHaveCount(0);

  // Ficha: la puntuación de BGG y sus expansiones.
  await catan.click();
  await expect(page.getByText("8/10")).toBeVisible();
  const expansiones = page.getByRole("region", { name: /Expansiones/ });
  await expect(expansiones).toContainText("Expansiones (1)");
  await expansiones.getByRole("link", { name: /Catan: Navegantes/ }).click();
  await expect(page.getByRole("heading", { name: "Catan: Navegantes", level: 1 })).toBeVisible();
  await expect(page.getByText("Expansión de")).toBeVisible();
  // Una expansión no se juega sola.
  await expect(page.getByRole("button", { name: "Jugar una partida" })).toHaveCount(0);

  // Volver a importar no repite nada.
  await page.goto("/cuenta");
  await page.waitForLoadState("networkidle");
  await bgg.getByRole("button", { name: "Traer mis juegos" }).click();
  await expect(bgg.getByText("Ya tenías todos tus juegos de BGG.")).toBeVisible();
  await expect(bgg.getByText("5 ya estaban en tu estante.")).toBeVisible();
});
