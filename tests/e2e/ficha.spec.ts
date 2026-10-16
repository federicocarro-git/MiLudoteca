import { expect, test, type Page } from "@playwright/test";
import {
  admin,
  borrarJuegosBgg,
  borrarUsuario,
  crearJuego,
  crearJuegoBgg,
  crearUsuario,
  iniciarSesion,
  subirImagen,
  type Usuario,
} from "./helpers";

const COMO = `## Objetivo
Ser el primero en llegar a **10 puntos de victoria**.

## Preparación
1. Armá la isla con los hexágonos.
2. Cada jugador pone 2 pueblos y 2 caminos.

> Consejo: empezá cerca del trigo y el mineral.

Más info en [la web oficial](https://www.catan.com).

<script>window.__hackeado = true</script>
<b>esto no debería verse en negrita</b>
`;

const HOJA = `## 1. Producción
- [ ] Tirar los dados
- [ ] Cada uno cobra según el número

## 2. Comercio
| Con quién | Cuánto | Notas largas para probar el scroll horizontal en el celular |
|---|---|---|
| Banco | 4:1 | Siempre disponible, sin importar dónde estés construyendo |
| Puerto genérico | 3:1 | Si tenés un pueblo o ciudad en un puerto 3:1 |

## Fin del turno
Pasale los dados al de la izquierda.
`;

let usuario: Usuario;
let idCatan: string;
let rutaFoto: string;

test.beforeEach(async ({ page }) => {
  usuario = await crearUsuario("ficha");
  const foto = await subirImagen(usuario);
  rutaFoto = foto.ruta;
  idCatan = await crearJuego(
    usuario,
    {
      nombre: "Catán",
      anio: 1995,
      jugadores_min: 3,
      jugadores_max: 4,
      duracion_min: 90,
      complejidad: 2.29,
      tipos: ["eurogame"],
      imagen_url: foto.url,
    },
    { puntuacion: 6, notas: "Falta una oveja" },
  );
  await admin
    .from("resumenes")
    .insert({ juego_id: idCatan, autor_id: usuario.id, como_se_juega: COMO, hoja_de_turno: HOJA });
  await iniciarSesion(page, usuario);
});
test.afterEach(() => borrarUsuario(usuario));

const pestana = (page: Page, nombre: string) =>
  page.getByRole("navigation", { name: "Secciones del juego" }).getByRole("link", { name: nombre });

test("ficha: pestañas, datos y edición de puntuación y notas", async ({ page }) => {
  await page.goto(`/juegos/${idCatan}`);
  await expect(page.getByRole("heading", { name: /Catán/ })).toBeVisible();
  await expect(pestana(page, "Ficha")).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("6/10")).toBeVisible();

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Tu puntuación", { exact: true }).selectOption("9");
  await page.getByLabel("Notas", { exact: true }).fill("Ya conseguí la oveja");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("9/10")).toBeVisible();
  await expect(page.getByText("Ya conseguí la oveja")).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("cómo se juega: markdown sin HTML crudo y links seguros", async ({ page }) => {
  await page.goto(`/juegos/${idCatan}`);
  await pestana(page, "Cómo se juega").click();
  await page.waitForURL(`**/juegos/${idCatan}/como-se-juega`);
  await expect(page.getByRole("heading", { name: "Preparación" })).toBeVisible();
  await expect(pestana(page, "Cómo se juega")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".md ol li")).toHaveCount(2);
  const link = page.getByRole("link", { name: "la web oficial" });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(page.locator(".md script, .md b")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as { __hackeado?: boolean }).__hackeado),
  ).toBeUndefined();
});

test("hoja de turno: legible en el celular e imprimible", async ({ page }) => {
  await page.goto(`/juegos/${idCatan}/hoja-de-turno`);
  await expect(page.getByRole("heading", { name: "2. Comercio" })).toBeVisible();
  await expect(page.locator(".md-hoja input[type=checkbox]")).toHaveCount(2);
  await expect(page.locator(".md-hoja")).toHaveCSS("font-size", "18px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator(".md-tabla")
      .first()
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);

  await page.emulateMedia({ media: "print" });
  for (const selector of [
    'nav[aria-label="Navegación principal"]',
    'nav[aria-label="Secciones del juego"]',
    "main a[href='/catalogo']",
  ]) {
    await expect(page.locator(selector).first()).toBeHidden();
  }
  await expect(page.locator("button", { hasText: "Imprimir" })).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    "rgb(255, 255, 255)",
  );
});

test("editar los datos de un juego propio y quitar la foto (se borra de Storage)", async ({
  page,
}) => {
  await page.goto(`/juegos/${idCatan}`);
  await page.getByRole("link", { name: "Editar datos del juego" }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Catán");
  await expect(page.getByLabel("Tu puntuación", { exact: true })).toHaveValue("6");
  await page.getByLabel("Nombre", { exact: true }).fill("Catán (edición viajera)");
  await page.getByLabel("Jugadores máx.").fill("6");
  await page.getByRole("button", { name: "Quitar" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.waitForURL(/editado=1/);
  await expect(page.getByText("Guardaste los cambios.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /edición viajera/ })).toBeVisible();
  await expect(page.getByText("3–6", { exact: true })).toBeVisible();
  const { data } = await admin.storage.from("imagenes-juegos").list(usuario.id);
  expect(data!.map((a) => `${usuario.id}/${a.name}`)).not.toContain(rutaFoto);
});

test("quitar un juego propio lo borra junto con sus resúmenes", async ({ page }) => {
  await page.goto(`/juegos/${idCatan}`);
  await page.getByRole("button", { name: "Quitar de mi estante" }).click();
  await expect(page.getByText("también se borran")).toBeVisible();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await page.waitForURL("**/catalogo");
  expect((await admin.from("juegos").select("id").eq("id", idCatan)).data).toEqual([]);
  expect((await admin.from("resumenes").select("id").eq("juego_id", idCatan)).data).toEqual([]);
});

test.describe("juegos de BGG", () => {
  test.describe.configure({ mode: "serial" });
  const [EN_CATALOGO, FUERA] = [888001, 888002];
  let idBgg: string;
  let idFuera: string;
  test.beforeEach(async () => {
    idBgg = await crearJuegoBgg({
      bgg_id: EN_CATALOGO,
      nombre: "Juego de BGG",
      jugadores_min: 2,
      jugadores_max: 5,
      descripcion: "Primer párrafo de BGG.\n\nSegundo párrafo.",
    });
    idFuera = await crearJuegoBgg({ bgg_id: FUERA, nombre: "Otro de BGG" });
    await admin.from("catalogo_usuario").insert({ user_id: usuario.id, juego_id: idBgg });
  });
  test.afterEach(() => borrarJuegosBgg(EN_CATALOGO, FUERA));

  test("sin resumen: link a BGG y 'Escribir' como opción secundaria; no se puede editar", async ({
    page,
  }) => {
    for (const [seccion, titulo] of [
      ["como-se-juega", "Todavía no hay un resumen de cómo se juega"],
      ["hoja-de-turno", "Todavía no hay hoja de turno"],
    ]) {
      await page.goto(`/juegos/${idBgg}/${seccion}`);
      await expect(page.getByText(titulo)).toBeVisible();
      await expect(page.getByText("En BoardGameGeek vas a encontrar el reglamento")).toBeVisible();
      const bgg = page.getByRole("link", { name: /Ver en BoardGameGeek/ });
      await expect(bgg).toHaveAttribute(
        "href",
        `https://boardgamegeek.com/boardgame/${EN_CATALOGO}`,
      );
      await expect(bgg).toHaveAttribute("target", "_blank");
      await expect(page.getByRole("link", { name: "Escribir" })).toHaveAttribute(
        "href",
        `/juegos/${idBgg}/resumen/editar?seccion=${seccion}`,
      );
    }
    await page.goto(`/juegos/${idBgg}`);
    await expect(page.getByText("En tu estante")).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar datos del juego" })).toHaveCount(0);
    await page.goto(`/juegos/${idBgg}/editar`);
    await expect(page.getByText(/404|could not be found/i).first()).toBeVisible();
  });

  test("quitarlo del catálogo conserva el juego compartido", async ({ page }) => {
    await page.goto(`/juegos/${idBgg}`);
    await page.getByRole("button", { name: "Quitar de mi estante" }).click();
    await expect(page.getByText("se conservan")).toBeVisible();
    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    await page.waitForURL("**/catalogo");
    expect((await admin.from("juegos").select("id").eq("id", idBgg)).data).toHaveLength(1);
  });

  test("la descripción de BGG se atribuye con link y respeta los párrafos", async ({ page }) => {
    await page.goto(`/juegos/${idBgg}`);
    const descripcion = page.locator("section", {
      has: page.getByRole("heading", { name: "Descripción" }),
    });
    await expect(descripcion.locator("p").first()).toHaveText(
      "Primer párrafo de BGG.\n\nSegundo párrafo.",
      {
        useInnerText: true,
      },
    );
    await expect(descripcion.getByText("Descripción:")).toBeVisible();
    await expect(descripcion.getByRole("link", { name: "BoardGameGeek" })).toHaveAttribute(
      "href",
      `https://boardgamegeek.com/boardgame/${EN_CATALOGO}`,
    );
    await expect(page.getByRole("link", { name: /Ver en BoardGameGeek/ })).toBeVisible();
  });

  test("agregarlo al catálogo desde la ficha", async ({ page }) => {
    await page.goto(`/juegos/${idFuera}`);
    await page.getByRole("button", { name: "Agregar a mi estante" }).click();
    await expect(page.getByText("En tu estante")).toBeVisible();
  });
});

test("juego manual sin bgg_id: las pestañas vacías ofrecen escribir y no hay link a BGG", async ({
  page,
}) => {
  const id = await crearJuego(usuario, {
    nombre: "Juego casero",
    descripcion: "Lo inventamos en casa.",
  });
  await page.goto(`/juegos/${id}/hoja-de-turno`);
  await expect(page.getByText("Todavía no hay hoja de turno")).toBeVisible();
  await expect(page.getByRole("link", { name: "Escribir" })).toBeVisible();
  await expect(page.getByRole("link", { name: /BoardGameGeek/ })).toHaveCount(0);
  await page.goto(`/juegos/${id}`);
  await expect(page.getByText("Lo inventamos en casa.")).toBeVisible();
  await expect(page.getByRole("link", { name: /BoardGameGeek/ })).toHaveCount(0);
});

test("juego manual con bgg_id de referencia: link 'Ver en BoardGameGeek' sin atribuir la descripción", async ({
  page,
}) => {
  const id = await crearJuego(usuario, {
    nombre: "Mi versión",
    bgg_id: 13,
    descripcion: "La edité yo.",
  });
  await page.goto(`/juegos/${id}`);
  await expect(page.getByRole("link", { name: /Ver en BoardGameGeek/ })).toHaveAttribute(
    "href",
    "https://boardgamegeek.com/boardgame/13",
  );
  await expect(page.getByText("Descripción:")).toHaveCount(0);
  await page.goto(`/juegos/${id}/como-se-juega`);
  await expect(page.getByRole("link", { name: /Ver en BoardGameGeek/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Escribir" })).toBeVisible();
});
