import { z } from "zod";

/** Usuario de BoardGameGeek: letras, números, guion bajo, espacios, puntos y guiones. */
export const usuarioBggSchema = z
  .string()
  .trim()
  .min(1, "Escribí tu usuario de BoardGameGeek.")
  .max(50, "Es muy largo para un usuario de BoardGameGeek.")
  .regex(
    /^[A-Za-z0-9_][A-Za-z0-9_ .-]*$/,
    "Usá el nombre de usuario de BGG, no el email (letras, números y _).",
  );

/** Una tanda de la importación: lo que manda el navegador. */
export const tandaBggSchema = z
  .array(
    z.object({
      bgg_id: z.number().int().positive().max(999_999_999),
      puntuacion: z.number().int().min(1).max(10).nullable(),
    }),
  )
  .min(1)
  .max(20);
