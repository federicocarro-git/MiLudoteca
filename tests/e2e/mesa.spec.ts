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
let caro: Usuario;
let azulId: string;

test.beforeEach(async () => {
  [ana, beto, caro] = await Promise.all([
    crearUsuario("ana"),
    crearUsuario("beto"),
    crearUsuario("caro"),
  ]);
  await Promise.all([
    prepararPerfil(ana, "Ana"),
    prepararPerfil(beto, "Beto"),
    prepararPerfil(caro, "Caro"),
  ]);
  await Promise.all([hacerAmigos(ana, beto), hacerAmigos(caro, ana)]);
  azulId = await crearJuego(ana, { nombre: "Azul", jugadores_min: 2, jugadores_max: 4 });
  await crearJuego(beto, {
    nombre: "Patchwork",
    jugadores_min: 2,
    jugadores_max: 2,
    duracion_min: 30,
  });
  await crearJuego(beto, { nombre: "Catan casero", jugadores_min: 3, jugadores_max: 4 });
  await crearJuego(caro, { nombre: "catan casero" }, { notas: "nota privada de Caro" });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto), borrarUsuario(caro)]);
});

test("¿Quién lo tiene?: juegos de los amigos y ocultar el catálogo", async ({ browser }) => {
  const pagina = await (await browser.newContext()).newPage();
  await iniciarSesion(pagina, ana);
  await pagina.getByRole("link", { name: "Jugar", exact: true }).click();
  await pagina.getByRole("link", { name: /¿Quién lo tiene\?/ }).click();

  const lista = pagina.getByRole("list", { name: "Juegos de tus amigos" });
  await expect(lista.getByRole("listitem")).toHaveText([
    /Catan casero.*Lo tiene Beto y Caro/,
    /Patchwork.*Lo tiene Beto/,
  ]);
  await expect(pagina.getByText("nota privada de Caro")).toHaveCount(0);
  await pagina.getByLabel("Buscar un juego").fill("patch");
  await expect(lista.getByRole("listitem")).toHaveCount(1);
  await pagina.getByLabel("Buscar un juego").fill("");
  await pagina.getByLabel("Amigo", { exact: true }).selectOption({ label: "Caro" });
  await expect(lista.getByRole("listitem")).toHaveText([/Catan casero.*Lo tiene Beto y Caro/]);

  // Caro oculta su catálogo desde Cuenta.
  const paginaCaro = await (await browser.newContext()).newPage();
  await iniciarSesion(paginaCaro, caro);
  await paginaCaro.goto("/cuenta");
  await paginaCaro.waitForLoadState("networkidle");
  const interruptor = paginaCaro.getByRole("switch", { name: /Mostrar mis juegos/ });
  await expect(interruptor).toBeChecked();
  await interruptor.uncheck();
  await expect(interruptor).not.toBeChecked();
  await paginaCaro.reload();
  await expect(paginaCaro.getByRole("switch", { name: /Mostrar mis juegos/ })).not.toBeChecked();

  await pagina.reload();
  await expect(lista.getByRole("listitem")).toHaveText([
    /Catan casero.*Lo tiene Beto$/,
    /Patchwork.*Lo tiene Beto/,
  ]);
});

test("en la ficha: qué amigos también lo tienen", async ({ page }) => {
  await crearJuego(ana, { nombre: "Catan Casero" });
  await iniciarSesion(page, ana);
  await page.goto("/catalogo");
  await page
    .getByRole("link", { name: /Catan Casero/ })
    .first()
    .click();
  await expect(page.getByText("También lo tiene Beto y Caro")).toBeVisible();
  await page.goto(`/juegos/${azulId}`);
  await expect(page.getByText(/También lo tiene/)).toHaveCount(0);
});

async function abrirSorteo(page: Page) {
  await page.getByRole("button", { name: "¿A qué jugamos?" }).filter({ visible: true }).click();
  return page.getByRole("dialog", { name: "¿A qué jugamos?" });
}

test("¿A qué jugamos? con la mesa y cambiar el juego de la sala", async ({ browser }) => {
  const contexto = await browser.newContext({ reducedMotion: "reduce" });
  const anfitrion = await contexto.newPage();
  await iniciarSesion(anfitrion, ana);
  await anfitrion.goto(`/juegos/${azulId}`);
  await anfitrion.getByRole("button", { name: "Jugar una partida" }).click();
  await anfitrion.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  await anfitrion.getByRole("button", { name: "Agregar", exact: true }).click();
  const agregar = anfitrion.getByRole("dialog", { name: "Agregar jugadores" });
  await agregar.getByRole("checkbox", { name: /Beto/ }).check();
  await agregar.getByRole("button", { name: "Agregar (1)" }).click();
  await expect(agregar).toBeHidden();

  const jugador = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await iniciarSesion(jugador, beto);
  await jugador.goto("/jugar");
  await jugador.getByRole("link", { name: /Azul/ }).click();
  await expect(jugador.getByRole("heading", { name: "Azul", level: 1 })).toBeVisible();

  // Dos en la mesa: sirven Azul (de Ana) y Patchwork (de Beto); Catan es de 3 a 4.
  const sorteo = await abrirSorteo(anfitrion);
  await expect(sorteo.getByText("3 juegos entre los catálogos de la mesa")).toBeVisible();
  await expect(sorteo.getByText("2 sirven para 2")).toBeVisible();
  await expect(sorteo.getByText("1 juego no entra")).toBeVisible();
  await sorteo.getByRole("button", { name: "Sortear" }).click();
  // "Otro" nunca repite: con dos opciones, alterna.
  if (await sorteo.getByText("Lo tiene Ana").isVisible()) {
    await expect(sorteo.getByRole("button", { name: "Ya es el de la sala" })).toBeDisabled();
    await sorteo.getByRole("button", { name: "Otro" }).click();
  }
  await expect(sorteo.getByText("Lo tiene Beto")).toBeVisible();
  await expect(sorteo.getByText("Patchwork", { exact: true })).toBeVisible();

  // Con duración máxima de 15 minutos no queda ninguno.
  await sorteo.getByLabel("Duración máxima").selectOption({ label: "Hasta 15 min" });
  await expect(sorteo.getByText("0 sirven para 2")).toBeVisible();
  await sorteo.getByLabel("Duración máxima").selectOption({ label: "Cualquiera" });
  await sorteo.getByRole("button", { name: "Sortear" }).click();
  if (await sorteo.getByText("Lo tiene Ana").isVisible()) {
    await sorteo.getByRole("button", { name: "Otro" }).click();
  }

  // Beto también puede sortear, pero no cambiar el juego.
  const sorteoBeto = await abrirSorteo(jugador);
  await sorteoBeto.getByRole("button", { name: "Sortear" }).click();
  await expect(sorteoBeto.getByRole("button", { name: "Jugar este" })).toHaveCount(0);
  await sorteoBeto.getByRole("button", { name: "Cerrar" }).click();

  // Ana pasa la sala a Patchwork; a Beto se le actualiza solo.
  await sorteo.getByRole("button", { name: "Jugar este" }).click();
  await expect(sorteo).toBeHidden();
  await expect(anfitrion.getByRole("heading", { name: "Patchwork", level: 1 })).toBeVisible();
  await expect(jugador.getByRole("heading", { name: "Patchwork", level: 1 })).toBeVisible();
});
