import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../../src/lib/supabase/database.types";

export const PASSWORD = "clave-segura-123";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);

export type Usuario = { id: string; email: string };

export function emailUnico(prefijo: string) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@ejemplo.com`;
}

/** Usuario confirmado con contraseña, creado con la API admin. */
export async function crearUsuario(prefijo = "e2e"): Promise<Usuario> {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailUnico(prefijo),
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email: data.user.email! };
}

/** Borra el usuario (en cascada: catálogo, juegos manuales y resúmenes). */
export async function borrarUsuario(usuario: Usuario | undefined) {
  if (!usuario) return;
  const { data } = await admin.storage.from("imagenes-juegos").list(usuario.id);
  if (data?.length) {
    await admin.storage.from("imagenes-juegos").remove(data.map((a) => `${usuario.id}/${a.name}`));
  }
  await admin.auth.admin.deleteUser(usuario.id);
}

export async function iniciarSesion(page: Page, usuario: Usuario) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/catalogo");
}

type JuegoNuevo = Database["public"]["Tables"]["juegos"]["Insert"];

/** Crea un juego manual del usuario y lo agrega a su catálogo. */
export async function crearJuego(
  usuario: Usuario,
  juego: Omit<JuegoNuevo, "origen" | "creado_por">,
  catalogo: { puntuacion?: number | null; notas?: string | null; agregado_en?: string } | null = {},
) {
  const { data, error } = await admin
    .from("juegos")
    .insert({ ...juego, origen: "manual", creado_por: usuario.id })
    .select("id")
    .single();
  if (error) throw error;
  if (catalogo) {
    const { error: e2 } = await admin
      .from("catalogo_usuario")
      .insert({ user_id: usuario.id, juego_id: data.id, ...catalogo });
    if (e2) throw e2;
  }
  return data.id;
}

/** Crea (o reemplaza) una fila de la cache de BGG. */
export async function crearJuegoBgg(juego: Omit<JuegoNuevo, "origen"> & { bgg_id: number }) {
  await admin.from("juegos").delete().eq("origen", "bgg").eq("bgg_id", juego.bgg_id);
  const { data, error } = await admin
    .from("juegos")
    .insert({ ...juego, origen: "bgg", bgg_sincronizado_en: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function borrarJuegosBgg(...bggIds: number[]) {
  await admin.from("juegos").delete().eq("origen", "bgg").in("bgg_id", bggIds);
}

/** Último mail que llegó a Mailpit para esa dirección: asunto y primer link. */
export async function ultimoMail(email: string) {
  let resultado: { asunto: string; link: string } | null = null;
  await expect
    .poll(
      async () => {
        const r = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const { messages } = (await r.json()) as { messages: Array<{ ID: string }> };
        if (!messages?.length) return false;
        const m = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
          Subject: string;
          HTML: string;
        };
        const href = m.HTML.match(/href="([^"]+)"/)?.[1];
        if (!href) return false;
        resultado = { asunto: m.Subject, link: href.replaceAll("&amp;", "&") };
        return true;
      },
      { timeout: 15_000, message: `no llegó el mail a ${email}` },
    )
    .toBe(true);
  return resultado!;
}

/** Foto JPEG grande (4000×3000), como la de un celular. */
export async function fotoDePrueba(): Promise<string> {
  const dir = join(tmpdir(), "miludoteca-e2e");
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, "foto-grande.jpg");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000">
    <rect width="4000" height="3000" fill="#0f766e"/>
    <text x="400" y="1600" font-size="400" fill="white" font-family="sans-serif">Juego casero</text>
  </svg>`;
  writeFileSync(ruta, await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer());
  return ruta;
}

/** Sube una imagen a la carpeta del usuario con la API admin y devuelve su URL pública. */
export async function subirImagen(usuario: Usuario, nombre = "caja.jpg") {
  const buffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#b45309" },
  })
    .jpeg()
    .toBuffer();
  const ruta = `${usuario.id}/${nombre}`;
  await admin.storage
    .from("imagenes-juegos")
    .upload(ruta, buffer, { contentType: "image/jpeg", upsert: true });
  return { ruta, url: admin.storage.from("imagenes-juegos").getPublicUrl(ruta).data.publicUrl };
}

export const ruta = (page: Page) => {
  const u = new URL(page.url());
  return u.pathname + u.search;
};

/** Pone un nombre fijo al perfil (lo crea el trigger) y devuelve su código de amigo. */
export async function prepararPerfil(usuario: Usuario, nombre: string) {
  const { data, error } = await admin
    .from("perfiles")
    .update({ nombre })
    .eq("id", usuario.id)
    .select("codigo_amigo")
    .single();
  if (error) throw error;
  return data.codigo_amigo;
}

/** Amistad ya aceptada entre dos usuarios (para los tests que la dan por hecha). */
export async function hacerAmigos(a: Usuario, b: Usuario) {
  const { error } = await admin.from("amistades").insert({
    solicitante_id: a.id,
    destinatario_id: b.id,
    estado: "aceptada",
    aceptada_en: new Date().toISOString(),
  });
  if (error) throw error;
}
