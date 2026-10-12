import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  PASSWORD,
  admin,
  borrarUsuario,
  crearJuego,
  crearUsuario,
  iniciarSesion,
  subirImagen,
  type Usuario,
} from "./helpers";

// Lo que un usuario no puede hacer con los datos de otro, a través de la app
// y de la API de Supabase con su propia sesión (RLS completo: supabase/tests).
let a: Usuario;
let b: Usuario;
let idDeA: string;
let fotoDeA: { ruta: string; url: string };

test.beforeEach(async () => {
  [a, b] = await Promise.all([crearUsuario("a"), crearUsuario("b")]);
  fotoDeA = await subirImagen(a);
  idDeA = await crearJuego(a, { nombre: "Juego privado de A", imagen_url: fotoDeA.url });
  await admin
    .from("resumenes")
    .insert({ juego_id: idDeA, autor_id: a.id, como_se_juega: "secreto" });
});
test.afterEach(async () => {
  await Promise.all([borrarUsuario(a), borrarUsuario(b)]);
});

async function clienteDe(usuario: Usuario) {
  const cliente = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
  const { error } = await cliente.auth.signInWithPassword({
    email: usuario.email,
    password: PASSWORD,
  });
  if (error) throw error;
  return cliente;
}

test("B no puede ver la ficha, las pestañas ni el editor de un juego de A", async ({ page }) => {
  await iniciarSesion(page, b);
  for (const sufijo of ["", "/como-se-juega", "/hoja-de-turno", "/editar", "/resumen/editar"]) {
    await page.goto(`/juegos/${idDeA}${sufijo}`);
    await expect(
      page.getByText(/404|could not be found/i).first(),
      sufijo || "ficha",
    ).toBeVisible();
    await expect(page.getByText("Juego privado de A")).toHaveCount(0);
  }
});

test("B no puede borrar ni reemplazar la foto de A con la API de Storage", async () => {
  const cliente = await clienteDe(b);
  await cliente.storage.from("imagenes-juegos").remove([fotoDeA.ruta]);
  const { error: errorSubida } = await cliente.storage
    .from("imagenes-juegos")
    .upload(fotoDeA.ruta, new Blob(["x"], { type: "image/png" }), { upsert: true });
  expect(errorSubida).not.toBeNull();
  const { data } = await admin.storage.from("imagenes-juegos").list(a.id);
  expect(data!.map((x) => `${a.id}/${x.name}`)).toContain(fotoDeA.ruta);
});

test("B no puede leer ni modificar los datos de A con la API", async () => {
  const cliente = await clienteDe(b);
  expect((await cliente.from("juegos").select("id").eq("id", idDeA)).data).toEqual([]);
  expect((await cliente.from("resumenes").select("id").eq("juego_id", idDeA)).data).toEqual([]);
  expect(
    (await cliente.from("catalogo_usuario").select("juego_id").eq("user_id", a.id)).data,
  ).toEqual([]);
  await cliente.from("juegos").update({ nombre: "hackeado" }).eq("id", idDeA);
  await cliente.from("juegos").delete().eq("id", idDeA);
  const { data } = await admin.from("juegos").select("nombre").eq("id", idDeA).single();
  expect(data!.nombre).toBe("Juego privado de A");
});
