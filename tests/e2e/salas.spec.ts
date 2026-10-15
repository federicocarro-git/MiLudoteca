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
let juegoId: string;

test.beforeEach(async () => {
  [ana, beto] = await Promise.all([crearUsuario("ana"), crearUsuario("beto")]);
  await Promise.all([prepararPerfil(ana, "Ana"), prepararPerfil(beto, "Beto")]);
  juegoId = await crearJuego(ana, { nombre: "Catan casero", jugadores_min: 3, jugadores_max: 4 });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto)]);
});

const fila = (page: Page, nombre: string) =>
  page
    .getByRole("list", { name: "Jugadores" })
    .getByRole("listitem", { name: nombre, exact: true });

async function crearSalaDesdeJugar(page: Page) {
  await page.getByRole("link", { name: "Jugar", exact: true }).click();
  await page.getByRole("link", { name: "Crear una sala" }).click();
  await page.getByRole("button", { name: /Catan casero/ }).click();
  await page.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  await expect(page.getByRole("heading", { name: "Catan casero" })).toBeVisible();
  await expect(page.getByText("En vivo")).toBeVisible();
  return codigoDeSala(page);
}

test("un invitado entra por el link del QR y los puntos se ven en vivo", async ({ browser }) => {
  const anfitrion = await (await browser.newContext()).newPage();
  await iniciarSesion(anfitrion, ana);
  const codigo = await crearSalaDesdeJugar(anfitrion);

  // El QR y el código para invitar.
  await anfitrion.getByRole("button", { name: "Invitar" }).click();
  const dialogo = anfitrion.getByRole("dialog", { name: "Invitar a la sala" });
  await expect(
    dialogo.getByRole("img", { name: `QR para entrar a la sala ${codigo}` }),
  ).toBeVisible();
  await expect(dialogo.getByTestId("codigo-sala")).toHaveText(codigo);
  await dialogo.getByRole("button", { name: "Cerrar" }).click();

  // Un invitado sin cuenta abre el link (lo que tiene el QR).
  const invitado = await (await browser.newContext()).newPage();
  await invitado.goto(`/sala/${codigo.toLowerCase()}`);
  await expect(invitado).toHaveURL(new RegExp(`/sala/${codigo}$`));
  await expect(invitado.getByText("Ana te invita a jugar")).toBeVisible();
  await invitado.waitForLoadState("networkidle");
  await expect(invitado.getByRole("heading", { name: "Catan casero" })).toBeVisible();
  await invitado.getByRole("button", { name: "Entrar como invitado" }).click();
  await expect(invitado.getByText("Escribí un nombre.")).toBeVisible();
  await invitado.getByLabel("Tu nombre").fill("Gabi");
  await invitado.getByRole("button", { name: "Entrar como invitado" }).click();
  await expect(fila(invitado, "Gabi")).toContainText("vos · invitado");
  await expect(invitado.getByText("En vivo")).toBeVisible();

  // El anfitrión lo ve aparecer sin recargar.
  await expect(fila(anfitrion, "Gabi")).toBeVisible();

  // El invitado suma 3 puntos; el anfitrión los ve en vivo.
  const sumar = invitado.getByRole("button", { name: "Sumar un punto a Gabi" });
  await sumar.click();
  await sumar.click();
  await sumar.click();
  await expect(invitado.getByLabel("Puntos de Gabi")).toHaveValue("3");
  await expect(anfitrion.getByLabel("Puntos de Gabi")).toHaveValue("3");

  // El invitado no puede tocar los puntos de Ana.
  await expect(fila(invitado, "Ana")).not.toContainText("Sumar");
  await expect(invitado.getByLabel("Puntos de Ana")).toHaveCount(0);

  // El anfitrión corrige los puntos del invitado escribiéndolos.
  await anfitrion.getByLabel("Puntos de Gabi").fill("10");
  await expect(invitado.getByLabel("Puntos de Gabi")).toHaveValue("10");
  await anfitrion.getByRole("button", { name: "Sumar un punto a Ana" }).click();
  await expect(fila(invitado, "Ana")).toContainText("1");
  await expect(fila(invitado, "Gabi").getByLabel("Va ganando")).toBeVisible();

  // Al recargar, los puntos siguen ahí (se guardaron).
  await invitado.reload();
  await expect(invitado.getByLabel("Puntos de Gabi")).toHaveValue("10");

  // El invitado no puede entrar al resto de la app.
  await invitado.goto("/catalogo");
  await expect(invitado).toHaveURL(/\/login\?next=%2Fcatalogo/);

  // El anfitrión cancela la sala: al invitado le avisa.
  await invitado.goto(`/sala/${codigo}`);
  await expect(fila(invitado, "Gabi")).toBeVisible();
  await anfitrion.getByRole("button", { name: "Cancelar la sala" }).click();
  await anfitrion
    .getByRole("dialog", { name: "¿Cancelar la sala?" })
    .getByRole("button", { name: "Cancelar la sala" })
    .click();
  await anfitrion.waitForURL("**/jugar");
  await expect(invitado.getByRole("heading", { name: "Ya no estás en esta sala" })).toBeVisible();
});

test("con cuenta: unirse con el código, agregar amigos y jugadores sin celular", async ({
  browser,
}) => {
  await hacerAmigos(ana, beto);
  const anfitrion = await (await browser.newContext()).newPage();
  await iniciarSesion(anfitrion, ana);
  const codigo = await crearSalaDesdeJugar(anfitrion);

  // El anfitrión agrega a Beto (amigo) y a la abuela (sin celular).
  await anfitrion.getByRole("button", { name: "Agregar", exact: true }).click();
  const dialogo = anfitrion.getByRole("dialog", { name: "Agregar jugadores" });
  await dialogo.getByRole("checkbox").check();
  await dialogo.getByRole("button", { name: "Agregar (1)" }).click();
  await expect(fila(anfitrion, "Beto")).toBeVisible();
  await anfitrion.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(dialogo.getByText("No hay amigos para agregar.")).toBeVisible();
  await dialogo.getByLabel("Nombre del jugador").fill("Abuela");
  await dialogo.getByRole("button", { name: "Agregar jugador" }).click();
  await expect(fila(anfitrion, "Abuela")).toContainText("sin celular");
  await anfitrion.getByRole("button", { name: "Sumar un punto a Abuela" }).click();
  await expect(anfitrion.getByLabel("Puntos de Abuela")).toHaveValue("1");

  // Beto ve la sala en Jugar → Partidas en curso.
  const jugador = await (await browser.newContext()).newPage();
  await iniciarSesion(jugador, beto);
  await jugador.goto("/jugar");
  await jugador.waitForLoadState("networkidle");
  await jugador.getByRole("link", { name: /Catan casero/ }).click();
  await expect(fila(jugador, "Beto")).toContainText("vos");
  await expect(jugador.getByLabel("Puntos de Abuela")).toHaveCount(0);

  // Beto sale de la sala y vuelve a entrar con el código.
  await jugador.getByRole("button", { name: "Salir de la sala" }).click();
  await jugador
    .getByRole("dialog", { name: "¿Salir de la sala?" })
    .getByRole("button", { name: "Salir" })
    .click();
  await jugador.waitForURL("**/jugar");
  await jugador.waitForLoadState("networkidle");
  await expect(fila(anfitrion, "Beto")).toBeHidden();
  await jugador.getByLabel("Código de la sala").fill("ZZZZZZ");
  await jugador.getByRole("button", { name: "Unirme" }).click();
  await expect(jugador.getByText("No hay ninguna sala en curso con ese código.")).toBeVisible();
  await jugador.getByLabel("Código de la sala").fill(codigo.toLowerCase());
  await jugador.getByRole("button", { name: "Unirme" }).click();
  await jugador.waitForURL(`**/sala/${codigo}`);
  await jugador.getByRole("button", { name: "Unirme a la sala" }).click();
  await expect(fila(jugador, "Beto")).toBeVisible();
  await expect(fila(anfitrion, "Beto")).toBeVisible();

  // El anfitrión saca a Beto.
  await anfitrion.getByRole("button", { name: "Sacar a Beto" }).click();
  await anfitrion
    .getByRole("dialog", { name: "¿Sacar al jugador?" })
    .getByRole("button", { name: "Sacar" })
    .click();
  await expect(fila(anfitrion, "Beto")).toBeHidden();
  await expect(jugador.getByRole("heading", { name: "Ya no estás en esta sala" })).toBeVisible();
});

test("crear una sala desde la ficha del juego", async ({ page }) => {
  await iniciarSesion(page, ana);
  await page.goto(`/juegos/${juegoId}`);
  await page.getByRole("button", { name: "Jugar una partida" }).click();
  await page.waitForURL(/\/sala\/[A-Z2-9]{6}$/);
  await expect(fila(page, "Ana")).toContainText("vos · anfitrión");
});

test("una sala que no existe", async ({ page }) => {
  await page.goto("/sala/ZZZZZZ");
  await expect(page.getByRole("heading", { name: "No encontramos esa sala" })).toBeVisible();
});
