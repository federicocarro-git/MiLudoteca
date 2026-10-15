import { expect, test, type Page } from "@playwright/test";
import {
  admin,
  borrarUsuario,
  codigoDeSala,
  crearJuego,
  crearUsuario,
  fotoDePrueba,
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
  juegoId = await crearJuego(ana, { nombre: "Carcassonne casero" });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto)]);
});

const fila = (page: Page, nombre: string) =>
  page
    .getByRole("list", { name: "Jugadores" })
    .getByRole("listitem", { name: nombre, exact: true });
const filaResultado = (page: Page, nombre: string) =>
  page
    .getByRole("list", { name: "Resultado" })
    .getByRole("listitem", { name: nombre, exact: true });

/** Ana crea la sala desde la ficha y agrega a Beto. Devuelve la página de Ana. */
async function salaConBeto(page: Page) {
  await iniciarSesion(page, ana);
  await page.goto(`/juegos/${juegoId}`);
  await page.getByRole("button", { name: "Jugar una partida" }).click();
  await page.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Agregar jugadores" });
  await dialogo.getByRole("checkbox").check();
  await dialogo.getByRole("button", { name: "Agregar (1)" }).click();
  // Hasta que no se cierra la hoja (modal), el resto de la página no responde.
  await expect(dialogo).toBeHidden();
  await expect(fila(page, "Beto")).toBeVisible();
  return codigoDeSala(page);
}

async function cargarPuntos(page: Page, nombre: string, puntos: number) {
  const campo = page.getByLabel(`Puntos de ${nombre}`).filter({ visible: true });
  await campo.fill(String(puntos));
  await expect(campo).toHaveValue(String(puntos));
}

test("terminar la partida: resultado para todos, notas, fotos e historial", async ({ browser }) => {
  const anfitrion = await (await browser.newContext()).newPage();
  const codigo = await salaConBeto(anfitrion);

  // Un invitado entra por el link.
  const invitado = await (await browser.newContext()).newPage();
  await invitado.goto(`/sala/${codigo}`);
  await invitado.waitForLoadState("networkidle");
  await invitado.getByLabel("Tu nombre").fill("Gabi");
  await invitado.getByRole("button", { name: "Entrar como invitado" }).click();
  await expect(fila(invitado, "Gabi")).toBeVisible();

  await cargarPuntos(anfitrion, "Ana", 20);
  await cargarPuntos(anfitrion, "Beto", 35);
  await cargarPuntos(anfitrion, "Gabi", 12);
  await expect(invitado.getByLabel("Puntos de Gabi")).toHaveValue("12");

  // Solo el anfitrión puede terminar.
  await expect(invitado.getByRole("button", { name: "Terminar partida" })).toHaveCount(0);

  await anfitrion.getByRole("button", { name: "Terminar partida" }).click();
  const dialogo = anfitrion.getByRole("dialog", { name: "Terminar partida" });
  await expect(dialogo.getByText("Gana Beto")).toBeVisible();
  await dialogo.getByLabel("Gana el que menos puntos tiene").check();
  await expect(dialogo.getByText("Gana Gabi")).toBeVisible();
  await dialogo.getByLabel("Gana el que más puntos tiene").check();
  await dialogo.getByRole("button", { name: "Terminar y guardar" }).click();

  // El anfitrión ve el resultado.
  await anfitrion.waitForURL(/\/partida\/[0-9a-f-]{36}$/);
  const urlPartida = anfitrion.url();
  await expect(anfitrion.getByRole("region", { name: "Resultado de la partida" })).toContainText(
    "Ganó Beto",
  );
  await expect(filaResultado(anfitrion, "Beto")).toContainText("1º");
  await expect(filaResultado(anfitrion, "Beto").getByLabel("Ganó")).toBeVisible();
  await expect(filaResultado(anfitrion, "Ana")).toContainText("2º");
  await expect(filaResultado(anfitrion, "Gabi")).toContainText("3º");

  // El invitado pasa solo al resultado y ve la invitación a crear cuenta.
  await invitado.waitForURL(urlPartida);
  await expect(invitado.getByText("Ganó Beto")).toBeVisible();
  await expect(invitado.getByText("Jugaste como invitado")).toBeVisible();
  await expect(invitado.getByRole("button", { name: "Agregar foto" })).toHaveCount(0);

  // El código de la sala ya no sirve.
  await invitado.goto(`/sala/${codigo}`);
  await expect(invitado.getByRole("heading", { name: "No encontramos esa sala" })).toBeVisible();

  // Ana escribe las notas.
  await anfitrion.waitForLoadState("networkidle");
  await anfitrion.getByLabel("Notas de la partida").fill("Beto ganó con un camino enorme");
  await anfitrion.getByRole("button", { name: "Guardar notas" }).click();
  await expect(anfitrion.getByText("Guardaste las notas.")).toBeVisible();

  // Beto ve la partida en su historial, las notas (sin poder editarlas) y sube una foto.
  const jugador = await (await browser.newContext()).newPage();
  await iniciarSesion(jugador, beto);
  await jugador.goto("/jugar");
  await jugador.getByRole("link", { name: /Historial/ }).click();
  await expect(jugador.getByText("1 partida · ganaste 1")).toBeVisible();
  await jugador.getByRole("link", { name: /Carcassonne casero/ }).click();
  await expect(jugador.getByText("Beto ganó con un camino enorme")).toBeVisible();
  await expect(jugador.getByLabel("Notas de la partida")).toHaveCount(0);
  await expect(jugador.getByRole("button", { name: "Borrar partida" })).toHaveCount(0);
  await jugador.getByLabel("Elegir foto").setInputFiles(await fotoDePrueba());
  await expect(jugador.getByRole("button", { name: "Ver foto 1" })).toBeVisible();

  // Ana ve la foto.
  await anfitrion.reload();
  await expect(anfitrion.getByRole("button", { name: "Ver foto 1" })).toBeVisible();

  // En la ficha del juego: cuántas veces se jugó, con link al historial filtrado.
  await anfitrion.goto(`/juegos/${juegoId}`);
  await anfitrion.getByRole("link", { name: /Lo jugaste 1 vez/ }).click();
  await expect(anfitrion).toHaveURL(new RegExp(`/jugar/historial\\?juego=${juegoId}`));
  await expect(anfitrion.getByLabel("Juego", { exact: true })).toHaveValue(juegoId);
  await expect(anfitrion.getByText("1 partida · ganaste 0")).toBeVisible();
});

test("cooperativo, ganadores elegidos a mano y borrar del historial", async ({ page }) => {
  await salaConBeto(page);

  // Cooperativo: hay que decir si ganaron.
  await page.getByRole("button", { name: "Terminar partida" }).click();
  const dialogo = page.getByRole("dialog", { name: "Terminar partida" });
  await dialogo.getByLabel("Cooperativo: todos juntos").check();
  await expect(dialogo.getByRole("button", { name: "Terminar y guardar" })).toBeDisabled();
  await dialogo.getByRole("button", { name: "Perdimos" }).click();
  await expect(dialogo.getByText("Perdieron todos")).toBeVisible();
  await dialogo.getByRole("button", { name: "Terminar y guardar" }).click();
  await page.waitForURL(/\/partida\//);
  await expect(page.getByText("Perdieron todos").first()).toBeVisible();

  // Otra partida, con el ganador elegido a mano (aunque tenga menos puntos).
  await page.getByRole("button", { name: "Jugar otra vez" }).click();
  await page.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  await page
    .getByRole("button", { name: "Agregar", exact: true })
    .filter({ visible: true })
    .click();
  const agregar = page.getByRole("dialog", { name: "Agregar jugadores" });
  await agregar.getByRole("checkbox").check();
  await agregar.getByRole("button", { name: "Agregar (1)" }).click();
  await expect(agregar).toBeHidden();
  await expect(fila(page, "Beto")).toBeVisible();
  await cargarPuntos(page, "Beto", 50);
  await page.getByRole("button", { name: "Terminar partida" }).filter({ visible: true }).click();
  await dialogo.getByLabel("Elegir a los ganadores").check();
  await expect(dialogo.getByText("Nadie gana")).toBeVisible();
  await dialogo.getByRole("button", { name: "Ana" }).click();
  await expect(dialogo.getByText("Gana Ana")).toBeVisible();
  await dialogo.getByRole("button", { name: "Terminar y guardar" }).click();
  await page.waitForURL(/\/partida\//);
  await expect(page.getByText("Ganó Ana").first()).toBeVisible();

  // Historial: dos partidas; filtrar por Beto.
  await page.goto("/jugar/historial");
  await expect(page.getByText("2 partidas · ganaste 1")).toBeVisible();
  await page.getByLabel("Jugaste con").selectOption({ label: "Beto" });
  await expect(page).toHaveURL(/con=/);
  await expect(page.getByText("2 partidas · ganaste 1")).toBeVisible();

  // Borrar la cooperativa.
  await page.getByRole("link", { name: /Perdieron todos/ }).click();
  await page.getByRole("button", { name: "Borrar partida" }).click();
  await page
    .getByRole("dialog", { name: "¿Borrar la partida?" })
    .getByRole("button", { name: "Borrar" })
    .click();
  await page.waitForURL("**/jugar/historial");
  await expect(page.getByText("1 partida · ganaste 1")).toBeVisible();

  const { count } = await admin
    .from("partidas")
    .select("id", { count: "exact", head: true })
    .eq("anfitrion_id", ana.id);
  expect(count).toBe(1);
});
