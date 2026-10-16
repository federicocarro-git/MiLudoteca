import { expect, test } from "@playwright/test";
import {
  admin,
  borrarUsuario,
  crearJuego,
  crearUsuario,
  iniciarSesion,
  type Usuario,
} from "./helpers";

let usuario: Usuario;
let id: string;
test.beforeEach(async ({ page }) => {
  usuario = await crearUsuario("resumen");
  id = await crearJuego(usuario, { nombre: "Pandemic" });
  await iniciarSesion(page, usuario);
});
test.afterEach(() => borrarUsuario(usuario));

test("escribir con la barra de formato, vista previa, borrador y guardar", async ({ page }) => {
  await page.goto(`/juegos/${id}/como-se-juega`);
  await page.getByRole("link", { name: "Escribir" }).click();
  await page.waitForURL(`**/juegos/${id}/resumen/editar?seccion=como-se-juega`);
  const area = page.locator("#texto-resumen");
  await expect(page.getByRole("tab", { name: "Cómo se juega" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: "Sin cambios" })).toBeDisabled();

  await page.getByRole("button", { name: "Usar plantilla" }).click();
  await expect(area).toHaveValue(/^## Objetivo/);

  // Barra de formato
  await area.fill("Objetivo\nCurar las 4 enfermedades");
  await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.getByRole("button", { name: "Título" }).click();
  await expect(area).toHaveValue(/^## Objetivo\n/);
  await area.evaluate((el: HTMLTextAreaElement) => {
    const i = el.value.indexOf("4 enfermedades");
    el.setSelectionRange(i, i + 1);
  });
  await page.getByRole("button", { name: "Negrita" }).click();
  await expect(area).toHaveValue(/\*\*4\*\* enfermedades/);
  await area.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(el.value.length, el.value.length),
  );
  await page.getByRole("button", { name: "Tabla" }).click();
  await expect(area).toHaveValue(/\n\n\| Columna \| Columna \|\n\| --- \| --- \|/);

  await page.getByRole("button", { name: "Vista previa" }).click();
  await expect(page.locator(".md h2", { hasText: "Objetivo" })).toBeVisible();
  await expect(page.locator(".md strong", { hasText: "4" })).toBeVisible();
  await page.getByRole("button", { name: "Escribir" }).click();

  // Otra sección; volver no pierde lo escrito
  await page.getByRole("tab", { name: "Hoja de turno" }).click();
  await expect(area).toHaveValue("");
  await area.fill("## 1. Tratar\n- [ ] Mover\n- [ ] Curar");
  await page.getByRole("tab", { name: "Cómo se juega" }).click();
  await expect(area).toHaveValue(/^## Objetivo/);

  // Salir con cambios pide confirmación
  let avisos = 0;
  page.once("dialog", (d) => {
    avisos++;
    void d.dismiss();
  });
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Estante" })
    .click();
  await expect.poll(() => avisos).toBe(1);
  expect(page.url()).toContain("/resumen/editar");

  // Borrador local después de recargar
  // Se recarga enseguida: el borrador se guarda al cerrar la página (pagehide),
  // sin esperar el debounce.
  const clave = `miludoteca:borrador-resumen:${id}`;
  page.once("dialog", (d) => void d.accept());
  await page.reload();
  await expect(page.getByText("Tenés un borrador sin guardar")).toBeVisible();
  await expect(area).toHaveValue("");
  await page.getByRole("button", { name: "Recuperar" }).click();
  await expect(area).toHaveValue(/^## Objetivo/);
  await page.getByRole("tab", { name: "Hoja de turno" }).click();
  await expect(area).toHaveValue(/- \[ \] Curar$/);

  // Guardar vuelve a la pestaña editada
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(`**/juegos/${id}/hoja-de-turno?guardado=1`);
  await expect(page.getByText("Guardaste el resumen.")).toBeVisible();
  await expect(page.locator(".md-hoja input[type=checkbox]")).toHaveCount(2);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), clave)).toBeNull();

  const { data } = await admin
    .from("resumenes")
    .select("autor_id, como_se_juega, hoja_de_turno")
    .eq("juego_id", id)
    .single();
  expect(data).toMatchObject({ autor_id: usuario.id });
  expect(data!.como_se_juega).toMatch(/^## Objetivo/);
  expect(data!.hoja_de_turno).toMatch(/- \[ \] Curar$/);
});

test("al volver a editar viene cargado y Cancelar sin cambios no pregunta", async ({ page }) => {
  await admin
    .from("resumenes")
    .insert({ juego_id: id, autor_id: usuario.id, hoja_de_turno: "## Fase\n- [ ] Mover" });
  await page.goto(`/juegos/${id}/resumen/editar?seccion=hoja-de-turno`);
  await expect(page.getByRole("tab", { name: "Hoja de turno" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#texto-resumen")).toHaveValue(/Mover/);
  await expect(page.getByText("Tenés un borrador sin guardar")).toHaveCount(0);
  let avisos = 0;
  page.on("dialog", (d) => {
    avisos++;
    void d.dismiss();
  });
  await page.getByRole("link", { name: "Cancelar" }).click();
  await page.waitForURL(`**/juegos/${id}/hoja-de-turno`);
  expect(avisos).toBe(0);
});
