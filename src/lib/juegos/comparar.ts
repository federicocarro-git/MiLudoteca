import type { DatosJuego } from "@/lib/game-data/types";

const CAMPOS = [
  "nombre",
  "imagen_url",
  "jugadores_min",
  "jugadores_max",
  "duracion_min",
  "complejidad",
  "anio",
  "descripcion",
] as const satisfies ReadonlyArray<keyof DatosJuego>;

function normalizar(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number") return String(Math.round(valor * 100) / 100);
  if (typeof valor === "string") {
    const n = Number(valor);
    // "2.50" y 2.5 son lo mismo (numeric de Postgres vs. número del formulario).
    if (valor.trim() !== "" && Number.isFinite(n)) return String(Math.round(n * 100) / 100);
    return valor.trim().replace(/\r\n/g, "\n");
  }
  return String(valor);
}

/**
 * ¿Los datos del formulario son los mismos que los de la fila cacheada de BGG?
 * Si lo son, se reusa esa fila compartida; si no, se guarda una versión propia.
 */
export function mismosDatos(a: Partial<DatosJuego>, b: Partial<DatosJuego>): boolean {
  if (CAMPOS.some((campo) => normalizar(a[campo]) !== normalizar(b[campo]))) return false;
  const tipos = (t: string[] | undefined) => [...(t ?? [])].sort().join("|");
  return tipos(a.tipos) === tipos(b.tipos);
}

/** Escapa los comodines de LIKE/ILIKE para buscar un texto literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
