// Crea usuarios de prueba con juegos en su catálogo, amigos entre sí y (si se
// pide) amigos de tu cuenta, para probar salas, "¿Quién lo tiene?", ranking...
//
// Usa la clave secreta (saltea RLS), así que se corre desde tu compu y nunca
// se sube: poné las claves del proyecto en un archivo .env.produccion (está
// ignorado por git):
//
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...
//
// Crear:  node --env-file=.env.produccion scripts/datos-de-prueba.mjs --amigo tu@mail.com
// Borrar: node --env-file=.env.produccion scripts/datos-de-prueba.mjs --borrar
//
// Los usuarios de prueba tienen mails @miludoteca.test (no existen: no se
// manda ningún mail) y comparten una contraseña nueva en cada corrida, que se
// imprime al final.

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DOMINIO = "miludoteca.test";

const JUEGOS = {
  Catan: {
    jugadores_min: 3,
    jugadores_max: 4,
    duracion_min: 90,
    complejidad: 2.3,
    anio: 1995,
    tipos: ["eurogame", "negociación", "dados"],
  },
  Carcassonne: {
    jugadores_min: 2,
    jugadores_max: 5,
    duracion_min: 45,
    complejidad: 1.9,
    anio: 2000,
    tipos: ["losetas", "familiar"],
  },
  Clue: {
    jugadores_min: 3,
    jugadores_max: 6,
    duracion_min: 45,
    complejidad: 1.7,
    anio: 1949,
    tipos: ["deducción", "familiar"],
  },
  Pandemic: {
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 2.4,
    anio: 2008,
    tipos: ["cooperativo"],
  },
  "The Crew": {
    jugadores_min: 2,
    jugadores_max: 5,
    duracion_min: 20,
    complejidad: 2.0,
    anio: 2019,
    tipos: ["cooperativo", "cartas"],
  },
  Hanabi: {
    jugadores_min: 2,
    jugadores_max: 5,
    duracion_min: 25,
    complejidad: 1.7,
    anio: 2010,
    tipos: ["cooperativo", "cartas"],
  },
  Dixit: {
    jugadores_min: 3,
    jugadores_max: 8,
    duracion_min: 30,
    complejidad: 1.2,
    anio: 2008,
    tipos: ["party"],
  },
  Azul: {
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 45,
    complejidad: 1.8,
    anio: 2017,
    tipos: ["abstracto", "familiar"],
  },
  "7 Wonders": {
    jugadores_min: 3,
    jugadores_max: 7,
    duracion_min: 30,
    complejidad: 2.3,
    anio: 2010,
    tipos: ["cartas", "eurogame"],
  },
  Patchwork: {
    jugadores_min: 2,
    jugadores_max: 2,
    duracion_min: 30,
    complejidad: 1.6,
    anio: 2014,
    tipos: ["abstracto"],
  },
  Codenames: {
    jugadores_min: 4,
    jugadores_max: 8,
    duracion_min: 15,
    complejidad: 1.3,
    anio: 2015,
    tipos: ["palabras", "por equipos", "party"],
  },
  "Ticket to Ride": {
    jugadores_min: 2,
    jugadores_max: 5,
    duracion_min: 60,
    complejidad: 1.8,
    anio: 2004,
    tipos: ["familiar"],
  },
};

// Catálogos que se pisan, para que "¿Quién lo tiene?" muestre varios dueños.
const USUARIOS = {
  Ana: ["Catan", "Carcassonne", "Pandemic", "Dixit"],
  Beto: ["Catan", "Clue", "7 Wonders", "The Crew"],
  Caro: ["Carcassonne", "Azul", "Hanabi", "Codenames"],
  Dani: ["Clue", "Pandemic", "Ticket to Ride", "Patchwork"],
  Eli: ["7 Wonders", "Dixit", "The Crew", "Azul"],
  Fran: ["Catan", "Codenames", "Hanabi", "Ticket to Ride"],
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
if (!url || !clave) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (ver el comentario del script).",
  );
  process.exit(1);
}
const admin = createClient(url, clave, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const amigo = args.includes("--amigo") ? args[args.indexOf("--amigo") + 1] : null;

async function todosLosUsuarios() {
  const usuarios = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    usuarios.push(...data.users);
    if (data.users.length < 1000) return usuarios;
  }
}

const esDePrueba = (u) => u.email?.endsWith(`@${DOMINIO}`);

async function borrar() {
  const dePrueba = (await todosLosUsuarios()).filter(esDePrueba);
  for (const u of dePrueba) {
    // Sus juegos manuales, catálogo, amistades y perfiles se van en cascada;
    // las salas que creó quedan sin anfitrión, así que se borran antes.
    await admin.from("partidas").delete().eq("anfitrion_id", u.id);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw error;
  }
  console.log(`Borrados ${dePrueba.length} usuarios de prueba.`);
}

async function crear() {
  const existentes = await todosLosUsuarios();
  if (existentes.some(esDePrueba)) {
    console.error("Ya hay usuarios de prueba. Borralos primero con --borrar.");
    process.exit(1);
  }
  const real = amigo
    ? existentes.find((u) => u.email?.toLowerCase() === amigo.toLowerCase())
    : null;
  if (amigo && !real) {
    console.error(`No encontré una cuenta con el mail ${amigo}.`);
    process.exit(1);
  }

  const password = `prueba-${randomBytes(6).toString("hex")}`;
  const creados = [];
  for (const [nombre, juegos] of Object.entries(USUARIOS)) {
    const email = `${nombre.toLowerCase()}@${DOMINIO}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre },
    });
    if (error) throw error;
    const id = data.user.id;

    // El perfil lo crea un trigger; se fija el nombre por las dudas.
    await admin.from("perfiles").update({ nombre }).eq("id", id);

    for (const titulo of juegos) {
      const { data: juego, error: e1 } = await admin
        .from("juegos")
        .insert({ nombre: titulo, origen: "manual", creado_por: id, ...JUEGOS[titulo] })
        .select("id")
        .single();
      if (e1) throw e1;
      const { error: e2 } = await admin
        .from("catalogo_usuario")
        .insert({ user_id: id, juego_id: juego.id, puntuacion: 6 + Math.floor(Math.random() * 5) });
      if (e2) throw e2;
    }
    creados.push({ nombre, email, id });
  }

  // Todos amigos entre sí y, si se pidió, de tu cuenta.
  const ids = creados.map((c) => c.id);
  const pares = [];
  for (let i = 0; i < ids.length; i++) {
    for (let k = i + 1; k < ids.length; k++) pares.push([ids[i], ids[k]]);
    if (real) pares.push([real.id, ids[i]]);
  }
  const { error } = await admin.from("amistades").insert(
    pares.map(([a, b]) => ({
      solicitante_id: a,
      destinatario_id: b,
      estado: "aceptada",
      aceptada_en: new Date().toISOString(),
    })),
  );
  if (error) throw error;

  console.log("Usuarios de prueba creados (todos amigos entre sí):\n");
  for (const c of creados)
    console.log(`  ${c.nombre.padEnd(5)} ${c.email.padEnd(24)} ${USUARIOS[c.nombre].join(", ")}`);
  console.log(`\nContraseña de todos: ${password}`);
  if (real) console.log(`También quedaron como amigos de ${real.email}.`);
}

(args.includes("--borrar") ? borrar() : crear()).catch((e) => {
  console.error(e);
  process.exit(1);
});
