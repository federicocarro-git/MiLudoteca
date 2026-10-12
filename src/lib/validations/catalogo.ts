import { juegoFormularioBase } from "./juego";

/** Puntuación y notas de un juego en el catálogo (mismas reglas que el alta). */
export const catalogoSchema = juegoFormularioBase.pick({ puntuacion: true, notas: true });
