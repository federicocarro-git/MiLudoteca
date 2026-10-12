import { z } from "zod";

export const LIMITES_RESUMEN = { como_se_juega: 100_000, hoja_de_turno: 50_000 } as const;

const texto = (max: number, nombre: string) =>
  z
    .string()
    .default("")
    // Normaliza fines de línea (\r\n de Windows/iOS) y quita espacios al final.
    .transform((t) => t.replace(/\r\n?/g, "\n").trimEnd())
    .pipe(
      z
        .string()
        .max(max, { error: `${nombre}: máximo ${max.toLocaleString("es-AR")} caracteres.` }),
    );

export const resumenSchema = z.object({
  como_se_juega: texto(LIMITES_RESUMEN.como_se_juega, "Cómo se juega"),
  hoja_de_turno: texto(LIMITES_RESUMEN.hoja_de_turno, "Hoja de turno"),
});

export const SECCIONES_RESUMEN = {
  "como-se-juega": "como_se_juega",
  "hoja-de-turno": "hoja_de_turno",
} as const;
export type SeccionUrl = keyof typeof SECCIONES_RESUMEN;
export type SeccionResumen = (typeof SECCIONES_RESUMEN)[SeccionUrl];

export function seccionDesdeUrl(valor: unknown): SeccionUrl {
  return valor === "hoja-de-turno" ? "hoja-de-turno" : "como-se-juega";
}
