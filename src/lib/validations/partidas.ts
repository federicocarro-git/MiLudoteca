import { z } from "zod";
import { MODOS_RESULTADO } from "@/lib/partidas/resultado";

export const terminarPartidaSchema = z
  .object({
    modo: z.enum(MODOS_RESULTADO, { error: "Elegí cómo se gana." }),
    ganadores: z.array(z.uuid()).max(20).default([]),
    ganamos: z.boolean().nullable().default(null),
  })
  .refine((v) => v.modo !== "cooperativo" || v.ganamos !== null, {
    message: "Elegí si ganaron o perdieron.",
    path: ["ganamos"],
  });

export type TerminarPartida = z.input<typeof terminarPartidaSchema>;

export const notasPartidaSchema = z.string().trim().max(2000, "Máximo 2000 caracteres.");
