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

export function formatearDuracion(minutos: number | null): string | null {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const NIVELES: Array<[number, string]> = [
  [1.8, "Liviano"],
  [2.6, "Medio-liviano"],
  [3.4, "Medio"],
  [4.2, "Medio-pesado"],
  [Infinity, "Pesado"],
];

/** Nombre del nivel de complejidad (escala 1-5 de BGG). */
export function nivelDeComplejidad(complejidad: number | null): string | null {
  if (complejidad === null || complejidad === undefined) return null;
  return NIVELES.find(([tope]) => complejidad < tope)![1];
}

export function formatearComplejidad(complejidad: number | null): string | null {
  const nivel = nivelDeComplejidad(complejidad);
  return nivel
    ? `${nivel} (${complejidad!.toLocaleString("es-AR", { maximumFractionDigits: 1 })}/5)`
    : null;
}
