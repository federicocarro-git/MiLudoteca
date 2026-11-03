// Los otros nombres de un juego en BGG vienen en todos los idiomas y sin decir
// cuál es cuál: se ordenan para que los que parecen en español queden arriba.

const PARECE_ESPANOL = /[áéíóúñ¿¡]|(^|\s)(el|la|los|las|un|una|del|juego)(\s|$)/i;
const OTRO_ALFABETO = /[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u;

/** Primero los que parecen en español; los de otros alfabetos, al final. */
export function ordenarNombresParaEspanol(nombres: string[]): string[] {
  const puntaje = (n: string) => (PARECE_ESPANOL.test(n) ? 0 : OTRO_ALFABETO.test(n) ? 2 : 1);
  return [...new Set(nombres)].sort((a, b) => puntaje(a) - puntaje(b) || a.localeCompare(b, "es"));
}
