import { expect, test, type Page } from "@playwright/test";
import {
  borrarUsuario,
  codigoDeSala,
  crearJuego,
  crearUsuario,
  hacerAmigos,
  iniciarSesion,
  prepararPerfil,
  type Usuario,
} from "./helpers";

let ana: Usuario;
let beto: Usuario;

test.beforeEach(async () => {
  [ana, beto] = await Promise.all([crearUsuario("ana"), crearUsuario("beto")]);
  await Promise.all([prepararPerfil(ana, "Ana"), prepararPerfil(beto, "Beto")]);
  await hacerAmigos(ana, beto);
  await crearJuego(ana, { nombre: "Azul", jugadores_min: 2, jugadores_max: 4 });
  await crearJuego(beto, { nombre: "Patchwork", jugadores_min: 2, jugadores_max: 2 });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto)]);
});

const titulo = (page: Page, nombre: string) =>
  page.getByRole("heading", { name: nombre, level: 1 }).filter({ visible: true });
const fila = (page: Page, nombre: string) =>
  page
    .getByRole("list", { name: "Jugadores" })
    .filter({ visible: true })
    .getByRole("listitem", { name: nombre, exact: true });

async function terminar(page: Page) {
  await page.getByRole("button", { name: "Terminar partida" }).filter({ visible: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Terminar partida" });
  await dialogo.getByRole("button", { name: "Terminar y guardar" }).click();
  await page.waitForURL(/\/partida\/[0-9a-f-]{36}$/);
}

test("sala sin juego, reabrir la partida y revancha con los mismos", async ({ browser }) => {
  // Ana crea la sala sin juego desde Jugar.
  const anfitrion = await (await browser.newContext()).newPage();
  await iniciarSesion(anfitrion, ana);
  await anfitrion.goto("/jugar");
  await anfitrion.waitForLoadState("networkidle");
  await anfitrion.getByRole("button", { name: "Elegimos en la mesa" }).click();
  await anfitrion.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  const codigo = codigoDeSala(anfitrion);
  await expect(titulo(anfitrion, "Sin juego todavía")).toBeVisible();
  await expect(anfitrion.getByRole("button", { name: "Terminar partida" })).toBeDisabled();

  // Beto entra con el código: la vista previa dice que no hay juego.
  const jugador = await (await browser.newContext()).newPage();
  await iniciarSesion(jugador, beto);
  await jugador.goto(`/sala/${codigo}`);
  await expect(titulo(jugador, "Sin juego todavía")).toBeVisible();
  await jugador.waitForLoadState("networkidle");
  await jugador.getByRole("button", { name: "Unirme a la sala" }).click();
  await expect(fila(jugador, "Beto")).toBeVisible();
  await expect(fila(anfitrion, "Beto")).toBeVisible();

  // Ana elige uno de los juegos de Beto.
  await anfitrion.getByRole("button", { name: "Ver los juegos de la mesa" }).click();
  const sorteo = anfitrion.getByRole("dialog", { name: "¿A qué jugamos?" });
  const juego = sorteo.getByLabel("Juego", { exact: true });
  await expect(juego.getByRole("option")).toHaveText([
    "Elegí un juego",
    "Azul · Ana",
    "Patchwork · Beto",
  ]);
  await juego.selectOption({ label: "Patchwork · Beto" });
  await sorteo.getByRole("button", { name: "Jugar este" }).click();
  await expect(sorteo).toBeHidden();
  await expect(titulo(anfitrion, "Patchwork")).toBeVisible();
  await expect(titulo(jugador, "Patchwork")).toBeVisible();
  await expect(anfitrion.getByRole("region", { name: "Falta elegir el juego" })).toHaveCount(0);

  // Ana termina; los dos ven el resultado.
  await terminar(anfitrion);
  const urlPartida = anfitrion.url();
  await jugador.waitForURL(urlPartida);

  // La terminó sin querer: la reabre y los dos vuelven a la sala, con el mismo código.
  await anfitrion.getByRole("button", { name: "Reabrir partida" }).click();
  await anfitrion.waitForURL(`**/sala/${codigo}`);
  await jugador.waitForURL(`**/sala/${codigo}`);
  await expect(fila(jugador, "Ana")).toBeVisible();

  // Ahora sí la termina y arma la revancha: Beto ya está sumado.
  await terminar(anfitrion);
  await jugador.waitForURL(urlPartida);
  await anfitrion.waitForLoadState("networkidle");
  await anfitrion.getByRole("button", { name: "Revancha" }).click();
  await anfitrion.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  const revancha = codigoDeSala(anfitrion);
  expect(revancha).not.toBe(codigo);
  await expect(titulo(anfitrion, "Patchwork")).toBeVisible();
  await expect(fila(anfitrion, "Beto")).toBeVisible();

  // A Beto le aparece el aviso en el resultado.
  const aviso = jugador.getByRole("region", { name: "Revancha" });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await aviso.getByRole("link", { name: "Ir a la revancha" }).click();
  await jugador.waitForURL(`**/sala/${revancha}`);
  await expect(fila(jugador, "Beto")).toBeVisible();
});
