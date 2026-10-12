import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  admin,
  borrarUsuario,
  crearUsuario,
  emailUnico,
  ruta,
  ultimoMail,
  type Usuario,
} from "./helpers";

test.describe("rutas protegidas", () => {
  test("sin sesión redirige a /login conservando a dónde iba", async ({ page }) => {
    await page.goto("/juegos/nuevo?x=1");
    expect(ruta(page)).toBe("/login?next=%2Fjuegos%2Fnuevo%3Fx%3D1");
  });

  test("/ lleva al catálogo (y de ahí al login)", async ({ page }) => {
    await page.goto("/");
    expect(ruta(page)).toBe("/login?next=%2Fcatalogo");
  });

  test("callback sin code vuelve al login con error", async ({ page }) => {
    await page.goto("/auth/callback");
    expect(ruta(page)).toBe("/login?error=link_invalido");
    await expect(page.getByText("El link no es válido")).toBeVisible();
  });
});

test.describe("cuenta nueva con email", () => {
  test.describe.configure({ mode: "serial" });
  const email = emailUnico("alta");
  let link = "";

  test.afterAll(async () => {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = data.users.find((x) => x.email === email);
    if (u) await borrarUsuario({ id: u.id, email });
  });

  test("valida el largo de la contraseña y no borra lo escrito", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Soy nuevo" }).click();
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("al menos 8 caracteres").first()).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);

    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Revisá tu email")).toBeVisible();
  });

  test("sin confirmar no puede entrar", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Todavía no confirmaste")).toBeVisible();
  });

  test("el mail de confirmación llega en español con token_hash", async () => {
    const mail = await ultimoMail(email);
    expect(mail.asunto).toBe("Confirmá tu cuenta de MiLudoteca");
    expect(mail.link).toMatch(/^http:\/\/localhost:3000\/auth\/confirm\?token_hash=/);
    link = mail.link;
  });

  test("confirmar desde otro navegador deja la sesión iniciada", async ({ page }) => {
    await page.goto(link);
    expect(ruta(page)).toBe("/catalogo");
  });

  test("el link no se puede reusar", async ({ page }) => {
    await page.goto(link);
    expect(ruta(page)).toMatch(/^\/login\?error=/);
    await expect(page.getByText("venció o ya se usó")).toBeVisible();
  });
});

test.describe("ingreso con contraseña", () => {
  let usuario: Usuario;
  test.beforeAll(async () => {
    usuario = await crearUsuario("login");
  });
  test.afterAll(() => borrarUsuario(usuario));

  test("contraseña incorrecta, después correcta y vuelve a la página pedida", async ({ page }) => {
    await page.goto("/cuenta");
    await page.getByLabel("Email").fill(usuario.email);
    await page.locator("#password").fill("incorrecta-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("no son correctos")).toBeVisible();

    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/cuenta");
    await expect(page.getByText(usuario.email)).toBeVisible();

    await page.goto("/login");
    expect(ruta(page)).toBe("/catalogo");
  });

  test("un next a otro sitio termina en el catálogo", async ({ page }) => {
    await page.goto("/login?next=//malo.com");
    await page.getByLabel("Email").fill(usuario.email);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("http://localhost:3000/catalogo");
  });

  test("cerrar sesión", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(usuario.email);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/catalogo");
    await page.goto("/cuenta");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL("**/login");
    await page.goto("/catalogo");
    expect(ruta(page)).toBe("/login?next=%2Fcatalogo");
  });
});

test("link mágico para un usuario nuevo, abierto en otro navegador", async ({ page, browser }) => {
  const email = emailUnico("magico");
  await page.goto("/login");
  await page.getByRole("button", { name: /link por email/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Mandame el link" }).click();
  await expect(page.getByText("Revisá tu email")).toBeVisible();

  const { link } = await ultimoMail(email);
  const otro = await browser.newPage();
  await otro.goto(link);
  expect(ruta(otro)).toBe("/catalogo");

  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data.users.find((x) => x.email === email);
  if (u) await borrarUsuario({ id: u.id, email });
});

test("el botón de Google lleva al authorize de Supabase con la vuelta correcta", async ({
  page,
}) => {
  await page.goto("/login");
  const [pedido] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/auth/v1/authorize")),
    page.getByRole("button", { name: "Continuar con Google" }).click(),
  ]);
  const url = new URL(pedido.url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(
    "http://localhost:3000/auth/callback?next=%2Fcatalogo",
  );
});
