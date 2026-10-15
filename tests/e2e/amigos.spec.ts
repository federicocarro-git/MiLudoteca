import { expect, test } from "@playwright/test";
import {
  admin,
  borrarUsuario,
  crearUsuario,
  hacerAmigos,
  iniciarSesion,
  prepararPerfil,
  type Usuario,
} from "./helpers";

let a: Usuario;
let b: Usuario;
let codigoDeA: string;
let codigoDeB: string;

test.beforeEach(async () => {
  [a, b] = await Promise.all([crearUsuario("a"), crearUsuario("b")]);
  [codigoDeA, codigoDeB] = await Promise.all([prepararPerfil(a, "Ana"), prepararPerfil(b, "Beto")]);
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(a), borrarUsuario(b)]);
});

test("pedir, aceptar y dejar de ser amigos", async ({ browser }) => {
  const paginaA = await (await browser.newContext()).newPage();
  const paginaB = await (await browser.newContext()).newPage();

  // A entra a Jugar → Amigos y ve su código.
  await iniciarSesion(paginaA, a);
  await paginaA.getByRole("link", { name: "Jugar", exact: true }).click();
  await paginaA.getByRole("link", { name: /Amigos/ }).click();
  await expect(paginaA.getByText(codigoDeA, { exact: true })).toBeVisible();
  await expect(paginaA.getByText("Todavía no tenés amigos")).toBeVisible();
  await paginaA.waitForLoadState("networkidle");

  // A escribe el código de B, en minúsculas y con un guion.
  const campo = paginaA.getByLabel("Código de tu amigo");
  await campo.fill("XXXXXX");
  await paginaA.getByRole("button", { name: "Mandar solicitud" }).click();
  await expect(paginaA.getByText("No encontramos a nadie con ese código")).toBeVisible();
  await campo.fill(`${codigoDeB.slice(0, 3).toLowerCase()}-${codigoDeB.slice(3).toLowerCase()}`);
  await paginaA.getByRole("button", { name: "Mandar solicitud" }).click();
  await expect(paginaA.getByText("Le mandaste la solicitud")).toBeVisible();
  await expect(campo).toHaveValue("");
  await expect(paginaA.getByRole("heading", { name: "Esperando respuesta" })).toBeVisible();
  await expect(paginaA.getByText("Beto")).toBeVisible();

  // B ve el aviso en Jugar y acepta.
  await iniciarSesion(paginaB, b);
  await paginaB.goto("/jugar");
  await expect(paginaB.getByText("1 solicitud nueva")).toBeAttached();
  await paginaB.getByRole("link", { name: /Amigos/ }).click();
  await paginaB.getByRole("button", { name: "Aceptar a Ana" }).click();
  await expect(paginaB.getByRole("heading", { name: "Tus amigos (1)" })).toBeVisible();
  await expect(paginaB.getByRole("heading", { name: "Solicitudes recibidas" })).toBeHidden();

  // A ya lo ve como amigo.
  await paginaA.reload();
  await expect(paginaA.getByRole("heading", { name: "Tus amigos (1)" })).toBeVisible();
  await expect(paginaA.getByRole("heading", { name: "Esperando respuesta" })).toBeHidden();

  // A deja de ser amigo de B (con confirmación).
  await paginaA.getByRole("button", { name: "Dejar de ser amigo de Beto" }).click();
  await paginaA.getByRole("dialog").getByRole("button", { name: "Dejar de ser amigos" }).click();
  await expect(paginaA.getByText("Todavía no tenés amigos")).toBeVisible();
  await paginaB.reload();
  await expect(paginaB.getByText("Todavía no tenés amigos")).toBeVisible();
});

test("rechazar una solicitud y cancelar una enviada", async ({ page }) => {
  await iniciarSesion(page, a);
  await page.goto(`/jugar/amigos?codigo=${codigoDeB}`);
  await page.waitForLoadState("networkidle");
  // El link compartido completa el código.
  await expect(page.getByLabel("Código de tu amigo")).toHaveValue(codigoDeB);
  await page.getByRole("button", { name: "Mandar solicitud" }).click();
  await page.getByRole("button", { name: "Cancelar la solicitud a Beto" }).click();
  await expect(page.getByRole("heading", { name: "Esperando respuesta" })).toBeHidden();

  // Ahora B le pide a A, y A la rechaza.
  await admin.from("amistades").insert({ solicitante_id: b.id, destinatario_id: a.id });
  await page.reload();
  await page.getByRole("button", { name: "Rechazar a Beto" }).click();
  await expect(page.getByRole("heading", { name: "Solicitudes recibidas" })).toBeHidden();
  await expect(page.getByText("Todavía no tenés amigos")).toBeVisible();
});

test("el código propio no sirve y una solicitud cruzada se acepta sola", async ({ page }) => {
  await iniciarSesion(page, a);
  await page.goto("/jugar/amigos");
  // Que React hidrate antes de escribir (si no, el input controlado se vacía).
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Código de tu amigo").fill(codigoDeA);
  await page.getByRole("button", { name: "Mandar solicitud" }).click();
  await expect(page.getByText("Ese es tu propio código.")).toBeVisible();

  await admin.from("amistades").insert({ solicitante_id: b.id, destinatario_id: a.id });
  await page.getByLabel("Código de tu amigo").fill(codigoDeB);
  await page.getByRole("button", { name: "Mandar solicitud" }).click();
  await expect(page.getByText("¡Ya son amigos!")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus amigos (1)" })).toBeVisible();
});

test("cambiar el nombre en Cuenta", async ({ page }) => {
  await hacerAmigos(a, b);
  await iniciarSesion(page, a);
  await page.getByRole("link", { name: "Cuenta", exact: true }).click();
  await expect(page.getByText(codigoDeA)).toBeVisible();
  await page.waitForLoadState("networkidle");
  const nombre = page.getByLabel("Tu nombre");
  await expect(nombre).toHaveValue("Ana");
  await nombre.fill("   ");
  await page.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(page.getByText("Escribí tu nombre.")).toBeVisible();
  await nombre.fill("Anita");
  await page.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(page.getByText("Guardaste tu nombre.")).toBeVisible();

  // Queda guardado para que lo vean los amigos.
  const { data } = await admin.from("perfiles").select("nombre").eq("id", a.id).single();
  expect(data?.nombre).toBe("Anita");
});
