import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  admin,
  borrarJuegosBgg,
  borrarUsuario,
  crearJuego,
  crearJuegoBgg,
  crearUsuario,
  fotoDePrueba,
  iniciarSesion,
  type Usuario,
} from "./helpers";

let usuario: Usuario;
test.beforeEach(async ({ page }) => {
  usuario = await crearUsuario("alta");
  await iniciarSesion(page, usuario);
});
test.afterEach(() => borrarUsuario(usuario));

const nombre = (page: import("@playwright/test").Page) =>
  page.getByLabel("Nombre", { exact: true });
const guardar = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Guardar en mi catálogo" });

test("buscar en el mock, completar el formulario y guardar", async ({ page }) => {
  await page.goto("/juegos/nuevo");
  await page.getByLabel("Buscar por nombre").fill("catán");
  await expect(page.getByRole("button", { name: /Catan Junior/ })).toBeVisible();
  await page.getByRole("button", { name: /^Catan \(1995\)/ }).click();

  await expect(page.getByText("Completamos los datos de")).toBeVisible();
  await expect(nombre(page)).toHaveValue("Catan");
  await expect(page.getByLabel("Jugadores máx.")).toHaveValue("4");
  await expect(page.getByRole("button", { name: "negociación", pressed: true })).toBeVisible();

  await page.getByLabel("Tu puntuación", { exact: true }).selectOption("8");
  await page.getByLabel("Notas", { exact: true }).fill("Falta una oveja");
  await guardar(page).click();

  await page.waitForURL(/\/juegos\/[0-9a-f-]{36}\?agregado=1/);
  await expect(page.getByText("¡Listo! Lo agregaste")).toBeVisible();
  await expect(page.getByText("3–4 jugadores")).toBeVisible();
  await expect(page.getByText("1 h 30 min")).toBeVisible();
  await expect(page.getByText("8/10")).toBeVisible();

  const { data } = await admin
    .from("catalogo_usuario")
    .select("puntuacion, notas")
    .eq("user_id", usuario.id);
  expect(data).toEqual([{ puntuacion: 8, notas: "Falta una oveja" }]);
});

test("errores por campo sin perder lo escrito", async ({ page }) => {
  await page.goto("/juegos/nuevo");
  await nombre(page).fill("Mal cargado");
  await page.getByLabel("Jugadores mín.").fill("6");
  await page.getByLabel("Jugadores máx.").fill("2");
  await page.getByLabel("Complejidad (1 a 5)").fill("7");
  await guardar(page).click();

  await expect(page.getByText("mayor que el máximo")).toBeVisible();
  await expect(page.getByText("La complejidad va de 1 a 5.")).toBeVisible();
  await expect(page.getByLabel("Jugadores máx.")).toHaveAttribute("aria-invalid", "true");
  await expect(nombre(page)).toHaveValue("Mal cargado");
});

test("avisa si el juego ya está en el catálogo y permite agregarlo igual", async ({ page }) => {
  await crearJuego(usuario, { nombre: "Catan" });
  await page.goto("/juegos/nuevo");
  await nombre(page).fill("CATAN");
  await guardar(page).click();
  await expect(page.getByText('Ya tenés "Catan" en tu catálogo.')).toBeVisible();
  await expect(nombre(page)).toHaveValue("CATAN");
  await page.getByRole("button", { name: "Agregar igual" }).click();
  await page.waitForURL(/agregado=1/);
});

test("foto: se achica en el navegador y se sube a la carpeta del usuario", async ({ page }) => {
  await page.goto("/juegos/nuevo");
  await nombre(page).fill("Juego casero");
  await page.getByLabel("Archivo de imagen").setInputFiles(await fotoDePrueba());
  await expect(page.getByRole("button", { name: "Cambiar foto" })).toBeVisible({ timeout: 20_000 });

  const src = await page.locator('img[alt="Caja de Juego casero"]').getAttribute("src");
  expect(src).toContain(`/storage/v1/object/public/imagenes-juegos/${usuario.id}/`);
  const meta = await sharp(Buffer.from(await (await fetch(src!)).arrayBuffer())).metadata();
  expect(meta.format).toBe("webp");
  expect(Math.max(meta.width!, meta.height!)).toBe(1200);

  await guardar(page).click();
  await page.waitForURL(/agregado=1/);
  await expect(page.locator('article img[alt="Caja de Juego casero"]')).toBeVisible();
});

test.describe("datos que vienen de BGG", () => {
  // Comparten la fila de BGG: no correr en paralelo.
  test.describe.configure({ mode: "serial" });
  const BGG_ID = 777001;
  test.beforeEach(() =>
    crearJuegoBgg({
      bgg_id: BGG_ID,
      nombre: "Juego BGG",
      jugadores_min: 2,
      jugadores_max: 4,
      complejidad: 2.5,
      tipos: ["cartas"],
    }),
  );
  test.afterEach(() => borrarJuegosBgg(BGG_ID));

  // La UI completa bgg_id solo desde el BggProvider (en los e2e se usa el mock):
  // se simula escribiendo el input oculto, como lo haría el formulario.
  async function cargar(page: import("@playwright/test").Page, nombreJuego: string) {
    await page.goto("/juegos/nuevo");
    await nombre(page).fill(nombreJuego);
    await page.getByLabel("Jugadores mín.").fill("2");
    await page.getByLabel("Jugadores máx.").fill("4");
    await page.getByLabel("Complejidad (1 a 5)").fill("2.5");
    await page.getByRole("button", { name: "cartas" }).click();
    await page
      .locator('input[name="bgg_id"]')
      .evaluate((el: HTMLInputElement) => (el.value = String(777001)));
    await guardar(page).click();
    await page.waitForURL(/agregado=1/);
    return new URL(page.url()).pathname.split("/")[2];
  }

  test("sin cambios reusa la fila compartida de BGG", async ({ page }) => {
    const { data: bgg } = await admin
      .from("juegos")
      .select("id")
      .eq("origen", "bgg")
      .eq("bgg_id", BGG_ID)
      .single();
    expect(await cargar(page, "Juego BGG")).toBe(bgg!.id);
  });

  test("con cambios crea una versión propia con el bgg_id de referencia", async ({ page }) => {
    const id = await cargar(page, "Juego BGG (edición casera)");
    const { data } = await admin
      .from("juegos")
      .select("origen, bgg_id, creado_por")
      .eq("id", id)
      .single();
    expect(data).toEqual({ origen: "manual", bgg_id: BGG_ID, creado_por: usuario.id });
  });
});
