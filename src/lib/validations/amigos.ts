import { z } from "zod";

/** Mismo alfabeto que public.generar_codigo(): sin I, O, 0 ni 1. */
export const CODIGO_AMIGO = /^[A-HJ-NP-Z2-9]{6}$/;

/** Acepta el código como lo escriba la persona: minúsculas, espacios o guiones. */
export function normalizarCodigo(valor: string) {
  return valor.toUpperCase().replace(/[\s-]/g, "");
}

export const codigoAmigoSchema = z
  .string()
  .transform(normalizarCodigo)
  .pipe(
    z
      .string()
      .min(1, "Escribí el código de tu amigo.")
      .regex(CODIGO_AMIGO, "El código tiene 6 letras y números (sin I, O, 0 ni 1)."),
  );

export const nombrePerfilSchema = z
  .string()
  .trim()
  .min(1, "Escribí tu nombre.")
  .max(40, "Máximo 40 caracteres.");
