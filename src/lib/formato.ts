// Textos para mostrar los datos de un juego (catálogo, ficha, formulario).

export function formatearJugadores(min: number | null, max: number | null): string | null {
  if (min && max)
    return min === max
      ? `${min} ${min === 1 ? "jugador" : "jugadores"}`
      : `${min}–${max} jugadores`;
  if (min) return `${min}+ jugadores`;
  if (max) return `Hasta ${max} jugadores`;
  return null;
}

/** Jugadores en corto, para tarjetas y datos: "2–4", "2", "3+", "≤5". */
export function jugadoresCorto(min: number | null, max: number | null): string | null {
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  return min ? `${min}+` : max ? `≤${max}` : null;
}

export function formatearDuracion(minutos: number | null): string | null {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// Los mismos tres niveles que el filtro del catálogo (NIVELES_COMPLEJIDAD).
const NIVELES: Array<[number, string]> = [
  [2, "Liviano"],
  [3, "Mediano"],
  [Infinity, "Pesado"],
];

/** Nombre del nivel de complejidad (escala 1-5 de BGG): Liviano, Mediano o Pesado. */
export function nivelDeComplejidad(complejidad: number | null): string | null {
  if (complejidad === null || complejidad === undefined) return null;
  return NIVELES.find(([tope]) => complejidad < tope)![1];
}

// Colores de los posavasos (avatares): se leen con letra crema en los dos modos.
const COLORES_AVATAR = ["#2f5d50", "#b9562a", "#25507d", "#8a6a4f", "#7a4b6e", "#9a6d14"];

/** Color fijo para un nombre (siempre el mismo para la misma persona). */
export function colorDeNombre(nombre: string): string {
  let suma = 0;
  for (const letra of nombre.trim().toLowerCase()) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return COLORES_AVATAR[suma % COLORES_AVATAR.length];
}
