import { z } from "zod";

export const configurarPuntajeSchema = z
  .object({
    tipo: z.enum(["total", "rondas", "categorias"], { error: "Elegí cómo se anota." }),
    categorias: z
      .array(z.string().trim().min(1).max(30, "Cada categoría, hasta 30 caracteres."))
      .max(20, "Hasta 20 categorías.")
      .default([]),
    /** Juego para el que se guarda la hoja (null: no guardarla). */
    guardarPara: z.uuid().nullable().default(null),
  })
  .refine((v) => v.tipo !== "categorias" || v.categorias.length > 0, {
    message: "Escribí al menos una categoría.",
    path: ["categorias"],
  });

export type ConfigurarPuntaje = z.input<typeof configurarPuntajeSchema>;
