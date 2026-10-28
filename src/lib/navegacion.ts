// Rutas de la barra inferior (components/layout/barra-inferior.tsx).

// Jugar va en el centro: la app es, antes que nada, el registro de lo que se juega.
export const RUTA_JUGAR = "/jugar";

export const RUTAS_BARRA = [
  "/catalogo",
  "/jugar/historial",
  RUTA_JUGAR,
  "/jugar/ranking",
  "/cuenta",
];

/**
 * La ruta de la barra que corresponde a la página: la más larga que coincide
 * (en /jugar/ranking se marca Ranking, no Jugar). Agregar un juego vive en
 * el Estante, así que /juegos/nuevo marca el Estante.
 */
export function itemActivo(pathname: string | null): string | null {
  if (pathname === null) return null;
  if (pathname === "/juegos/nuevo") return "/catalogo";
  const coinciden = RUTAS_BARRA.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return coinciden.sort((a, b) => b.length - a.length)[0] ?? null;
}
