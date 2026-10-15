import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UsuarioActual = { id: string; email: string | null };

export type SesionActual = UsuarioActual & {
  /** Invitado de una sala (usuario anónimo de Supabase): sin cuenta ni perfil. */
  anonimo: boolean;
};

// Lee cookies: usarlo dentro de un <Suspense>, una Server Action o un Route Handler.

/** Cualquier sesión, incluida la de un invitado anónimo. Solo para las salas. */
export async function getSesionActual(): Promise<SesionActual | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" && claims.email ? claims.email : null,
    anonimo: claims.is_anonymous === true,
  };
}

/**
 * Usuario con cuenta. Un invitado anónimo cuenta como sin sesión: fuera de
 * las salas no puede hacer nada (RLS se lo impide igual).
 */
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const sesion = await getSesionActual();
  if (!sesion || sesion.anonimo) return null;
  return { id: sesion.id, email: sesion.email };
}
