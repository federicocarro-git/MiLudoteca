// Rutas a las que se puede entrar sin sesión. /sala/<código> es a donde lleva
// el QR: ahí se elige entrar como invitado o con la cuenta. /partida/<id> es
// el resultado, que también ven los invitados (RLS decide qué se muestra).
const PREFIJOS_PUBLICOS = ["/login", "/auth", "/offline", "/sala", "/partida"];

export function esRutaPublica(pathname: string): boolean {
  return PREFIJOS_PUBLICOS.some(
    (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`),
  );
}

export const RUTA_INICIO = "/catalogo";

// Valida el destino de un "?next=" para no redirigir a otro sitio
// (open redirect): solo se aceptan rutas internas absolutas.
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return RUTA_INICIO;
  }
  return next;
}
