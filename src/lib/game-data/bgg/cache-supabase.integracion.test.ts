import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { DatosJuego } from "../types";
import { CacheSupabase } from "./cache-supabase";

// Corre contra el Supabase local: `npm run test:integracion` (con `npm run db:start`).
const habilitado = process.env.SUPABASE_INTEGRACION === "1";
const BGG_ID = 900000 + Math.floor(Math.random() * 99999);

describe.skipIf(!habilitado)("CacheSupabase (integración)", () => {
  const admin = habilitado
    ? createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        { auth: { persistSession: false } },
      )
    : null!;
  const cache = new CacheSupabase(admin);

  const datos: DatosJuego = {
    bgg_id: BGG_ID,
    nombre: "Juego de prueba",
    imagen_url: "https://cf.geekdo-images.com/x.jpg",
    jugadores_min: 2,
    jugadores_max: 4,
    duracion_min: 60,
    complejidad: 2.5,
    anio: 2020,
    descripcion: "Descripción",
    tipos: ["cooperativo"],
    es_expansion: false,
    expande: [],
  };

  afterAll(async () => {
    await admin.from("juegos").delete().eq("bgg_id", BGG_ID);
  });

  it("devuelve null si no está cacheado", async () => {
    expect(await cache.obtener(BGG_ID)).toBeNull();
  });

  it("guarda y lee", async () => {
    const t = new Date("2026-10-01T00:00:00Z");
    await cache.guardar(datos, t);
    expect(await cache.obtener(BGG_ID)).toEqual({ datos, sincronizadoEn: t });
  });

  it("al volver a guardar actualiza la misma fila", async () => {
    const t = new Date("2026-10-12T00:00:00Z");
    await cache.guardar({ ...datos, nombre: "Actualizado" }, t);
    const { data } = await admin.from("juegos").select("nombre, origen").eq("bgg_id", BGG_ID);
    expect(data).toEqual([{ nombre: "Actualizado", origen: "bgg" }]);
  });

  it("guardados simultáneos no duplican la fila", async () => {
    const otro = BGG_ID + 1;
    try {
      await Promise.all(
        [1, 2, 3].map((n) =>
          cache.guardar({ ...datos, bgg_id: otro, nombre: `v${n}` }, new Date()),
        ),
      );
      const { data } = await admin.from("juegos").select("id").eq("bgg_id", otro);
      expect(data).toHaveLength(1);
    } finally {
      await admin.from("juegos").delete().eq("bgg_id", otro);
    }
  });

  it("ignora juegos manuales con el mismo bgg_id", async () => {
    // Un juego manual puede tener bgg_id como referencia: no es la cache.
    const { data: usuario } = await admin.auth.admin.createUser({
      email: `cache-${BGG_ID}@ejemplo.com`,
      email_confirm: true,
    });
    const manual = BGG_ID + 2;
    try {
      await admin.from("juegos").insert({
        bgg_id: manual,
        nombre: "Mi versión",
        origen: "manual",
        creado_por: usuario.user!.id,
      });
      expect(await cache.obtener(manual)).toBeNull();
      await cache.guardar({ ...datos, bgg_id: manual }, new Date());
      const { data } = await admin
        .from("juegos")
        .select("origen")
        .eq("bgg_id", manual)
        .order("origen");
      expect(data).toEqual([{ origen: "bgg" }, { origen: "manual" }]);
    } finally {
      await admin.auth.admin.deleteUser(usuario.user!.id);
      await admin.from("juegos").delete().eq("bgg_id", manual);
    }
  });
});
