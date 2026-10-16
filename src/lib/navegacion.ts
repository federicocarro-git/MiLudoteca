// Rutas de la barra inferior (components/layout/barra-inferior.tsx).

export const RUTA_AGREGAR = "/juegos/nuevo";

export const RUTAS_BARRA = ["/catalogo", "/jugar", RUTA_AGREGAR, "/jugar/ranking", "/cuenta"];

/**
 * La ruta de la barra que corresponde a la página: la más larga que coincide
 * (en /jugar/ranking se marca Ranking, no Jugar).
 */
export function itemActivo(pathname: string | null): string | null {
  if (pathname === null) return null;
  const coinciden = RUTAS_BARRA.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return coinciden.sort((a, b) => b.length - a.length)[0] ?? null;
}
