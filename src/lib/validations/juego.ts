import { z } from "zod";
import { TIPOS } from "@/lib/game-data/tipos";

// Valida el formulario de alta de juego. Los valores llegan como texto
// (FormData): "" significa "sin dato" (null).

const vacioANull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

const entero = (min: number, max: number, nombre: string) =>
  z.preprocess(
    (v) => {
      const x = vacioANull(v);
      return x === null ? null : Number(x);
    },
    z
      .number({ error: `${nombre}: ingresá un número.` })
      .int({ error: `${nombre}: tiene que ser un número entero.` })
      .min(min, { error: `${nombre}: el mínimo es ${min}.` })
      .max(max, { error: `${nombre}: el máximo es ${max}.` })
      .nullable(),
  );

const textoOpcional = (max: number, nombre: string) =>
  z.preprocess(
    (v) => {
      const x = vacioANull(v);
      return typeof x === "string" ? x.trim() : x;
    },
    z
      .string()
      .max(max, { error: `${nombre}: máximo ${max} caracteres.` })
      .nullable(),
  );

export const URL_IMAGEN_VALIDA = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)/;

export const juegoFormularioSchema = z
  .object({
    nombre: z
      .string({ error: "Ingresá el nombre." })
      .trim()
      .min(1, { error: "Ingresá el nombre." })
      .max(200, { error: "El nombre puede tener hasta 200 caracteres." }),
    imagen_url: z.preprocess(
      vacioANull,
      z
        .string()
        .regex(URL_IMAGEN_VALIDA, { error: "La imagen tiene que ser una URL https." })
        .max(2000)
        .nullable(),
    ),
    jugadores_min: entero(1, 100, "Jugadores mínimos"),
    jugadores_max: entero(1, 100, "Jugadores máximos"),
    duracion_min: entero(1, 10000, "Duración"),
    complejidad: z.preprocess(
      (v) => {
        const x = vacioANull(v);
        return x === null ? null : Number(String(x).replace(",", "."));
      },
      z
        .number({ error: "Complejidad: ingresá un número." })
        .min(1, { error: "La complejidad va de 1 a 5." })
        .max(5, { error: "La complejidad va de 1 a 5." })
        .transform((n) => Math.round(n * 100) / 100)
        .nullable(),
    ),
    anio: entero(-5000, 2200, "Año"),
    descripcion: textoOpcional(20000, "Descripción"),
    tipos: z
      .array(z.enum(TIPOS, { error: "Hay un tipo que no existe." }))
      .max(TIPOS.length)
      .transform((t) => [...new Set(t)].sort((a, b) => a.localeCompare(b, "es"))),
    // Datos del catálogo personal.
    puntuacion: entero(1, 10, "Puntuación"),
    notas: textoOpcional(5000, "Notas"),
    // Referencia a BGG (cuando los datos vienen de una búsqueda).
    bgg_id: entero(1, 999_999_999, "Id de BGG"),
    confirmar_duplicado: z.preprocess((v) => v === "1" || v === "true", z.boolean()),
  })
  .refine(
    (d) =>
      d.jugadores_min === null || d.jugadores_max === null || d.jugadores_min <= d.jugadores_max,
    { error: "El mínimo de jugadores no puede ser mayor que el máximo.", path: ["jugadores_max"] },
  );

export type JuegoFormulario = z.infer<typeof juegoFormularioSchema>;
export type CampoJuego = keyof JuegoFormulario;

/** Arma el objeto a validar desde el FormData (tipos puede venir repetido). */
export function datosDesdeFormData(fd: FormData) {
  const datos: Record<string, unknown> = Object.fromEntries(fd);
  datos.tipos = fd.getAll("tipos");
  return datos;
}

/** Primer error de cada campo, para mostrarlo debajo del input. */
export function erroresPorCampo(issues: z.core.$ZodIssue[]): Partial<Record<CampoJuego, string>> {
  const errores: Partial<Record<CampoJuego, string>> = {};
  for (const issue of issues) {
    const campo = issue.path[0] as CampoJuego | undefined;
    if (campo && !errores[campo]) errores[campo] = issue.message;
  }
  return errores;
}
