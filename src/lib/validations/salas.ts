import { z } from "zod";
import { CODIGO_AMIGO, normalizarCodigo } from "./amigos";

/** Código de sala: mismo formato que el de amigo (6, sin I, O, 0 ni 1). */
export const codigoSalaSchema = z
  .string()
  .transform(normalizarCodigo)
  .pipe(
    z
      .string()
      .min(1, "Escribí el código de la sala.")
      .regex(CODIGO_AMIGO, "El código tiene 6 letras y números (sin I, O, 0 ni 1)."),
  );

/** Nombre de un invitado o de un jugador sin celular. */
export const nombreJugadorSchema = z
  .string()
  .trim()
  .min(1, "Escribí un nombre.")
  .max(40, "Máximo 40 caracteres.");

export const PUNTOS_MAX = 1_000_000;

export const puntosSchema = z
  .number({ error: "Los puntos tienen que ser un número." })
  .int("Los puntos tienen que ser un número entero.")
  .min(-PUNTOS_MAX, "Demasiado bajo.")
  .max(PUNTOS_MAX, "Demasiado alto.");
