import { expect, test } from "@playwright/test";
import {
  borrarUsuario,
  crearPartidaTerminada,
  crearUsuario,
  hacerAmigos,
  iniciarSesion,
  prepararPerfil,
  type Usuario,
} from "./helpers";

let ana: Usuario;
let beto: Usuario;
let caro: Usuario;

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

  const catan = { nombre: "Catan" };
  // Ana gana, Beto segundo, la abuela (sin celular) tercera.
  await crearPartidaTerminada(ana, catan, [
    { usuario: ana, gano: true, posicion: 1 },
    { usuario: beto, gano: false, posicion: 2 },
    { nombre: "Abuela", gano: false, posicion: 3 },
  ]);
  // Gana Beto; Ana y Caro empatan segundas.
  await crearPartidaTerminada(ana, catan, [
    { usuario: ana, gano: false, posicion: 2 },
    { usuario: beto, gano: true, posicion: 1 },
    { usuario: caro, gano: false, posicion: 2 },
  ]);
  // Dixit: gana Beto.
  await crearPartidaTerminada(beto, { nombre: "Dixit" }, [
    { usuario: ana, gano: false, posicion: 2 },
    { usuario: beto, gano: true, posicion: 1 },
  ]);
  // Cooperativo: no cuenta.
  await crearPartidaTerminada(
    ana,
    { nombre: "Pandemic" },
    [
      { usuario: ana, gano: true },
      { usuario: caro, gano: true },
    ],
    "cooperativo",
  );
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(ana), borrarUsuario(beto), borrarUsuario(caro)]);
});

test("ranking de victorias, filtro por juego y cara a cara", async ({ page }) => {
  await iniciarSesion(page, ana);
  await page.getByRole("link", { name: "Jugar", exact: true }).click();
  await page.getByRole("link", { name: /Ranking/ }).click();

  const ranking = page.getByRole("list", { name: "Ranking" });
  await expect(ranking.getByRole("listitem")).toHaveText([
    /Beto.*3 partidas · 67%.*2victorias/,
    /Ana \(vos\).*3 partidas · 33%.*1victoria/,
    /Caro.*1 partida · 0%.*0victorias/,
  ]);

  // Cara a cara y némesis.
  const caraACara = page.getByRole("list", { name: "Cara a cara" });
  await expect(caraACara.getByRole("link", { name: "Beto: vos 1, Beto 2" })).toBeVisible();
  await expect(caraACara.getByRole("link", { name: "Caro: vos 0, Caro 0" })).toContainText(
    "1 empate",
  );
  await expect(page.getByText("Tu némesis: Beto.")).toBeVisible();

  // Solo Dixit (el cooperativo no aparece entre los juegos).
  await page.waitForLoadState("networkidle");
  const juego = page.getByLabel("Juego", { exact: true });
  await expect(juego.getByRole("option", { name: "Pandemic" })).toHaveCount(0);
  await juego.selectOption({ label: "Dixit" });
  await expect(page).toHaveURL(/\?juego=/);
  await expect(ranking.getByRole("listitem")).toHaveText([
    /Beto.*1victoria/,
    /Ana \(vos\).*0victorias/,
  ]);
  await expect(caraACara.getByRole("link")).toHaveCount(1);

  // El cara a cara lleva al historial con esa persona y ese juego.
  await caraACara.getByRole("link", { name: /Beto/ }).click();
  await expect(page).toHaveURL(/\/jugar\/historial\?con=.+&juego=/);
  await expect(page.getByText("1 partida · ganaste 0")).toBeVisible();
});

test("sin partidas: estás vos solo y un mensaje en el cara a cara", async ({ page }) => {
  await iniciarSesion(page, caro);
  await borrarUsuario(ana); // se lleva sus partidas
  await page.goto("/jugar/ranking");
  await expect(page.getByRole("list", { name: "Ranking" }).getByRole("listitem")).toHaveText([
    /Caro \(vos\).*0 partidas · —.*0victorias/,
  ]);
  await expect(page.getByText("Cuando termines partidas con tus amigos")).toBeVisible();
});
