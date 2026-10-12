import type { DatosJuego } from "@/lib/game-data/types";

// Valores del formulario de juego (todo como texto, como en los inputs).
// Fuera del componente cliente para poder armarlos también en el servidor.

export type ValoresJuego = {
  nombre: string;
  imagen_url: string | null;
  jugadores_min: string;
  jugadores_max: string;
  duracion_min: string;
  complejidad: string;
  anio: string;
  descripcion: string;
  tipos: string[];
  puntuacion: string;
  notas: string;
};

export const VACIO: ValoresJuego = {
  nombre: "",
  imagen_url: null,
  jugadores_min: "",
  jugadores_max: "",
  duracion_min: "",
  complejidad: "",
  anio: "",
  descripcion: "",
  tipos: [],
  puntuacion: "",
  notas: "",
};

export const texto = (n: number | null) => (n === null ? "" : String(n));

/** Valores del formulario a partir de datos del juego (y del catálogo). */
export function valoresDesde(
  datos: DatosJuego,
  actuales: ValoresJuego = VACIO,
  catalogo?: { puntuacion: number | null; notas: string | null } | null,
): ValoresJuego {
  return {
    ...actuales,
    nombre: datos.nombre,
    imagen_url: datos.imagen_url,
    jugadores_min: texto(datos.jugadores_min),
    jugadores_max: texto(datos.jugadores_max),
    duracion_min: texto(datos.duracion_min),
    complejidad: texto(datos.complejidad),
    anio: texto(datos.anio),
    descripcion: datos.descripcion ?? "",
    tipos: [...datos.tipos],
    ...(catalogo && { puntuacion: texto(catalogo.puntuacion), notas: catalogo.notas ?? "" }),
  };
}
