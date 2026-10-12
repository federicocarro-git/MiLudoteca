import { z } from "zod";

export const LARGO_MINIMO_PASSWORD = 8;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresá un email válido." }));

const next = z.string().optional();

export const formularioEmailSchema = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("ingresar"),
    email,
    password: z.string().min(1, { error: "Ingresá tu contraseña." }),
    next,
  }),
  z.object({
    modo: z.literal("crear"),
    email,
    password: z.string().min(LARGO_MINIMO_PASSWORD, {
      error: `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
    }),
    next,
  }),
  z.object({ modo: z.literal("link"), email, next }),
]);

export type FormularioEmail = z.infer<typeof formularioEmailSchema>;
export type ModoEmail = FormularioEmail["modo"];
