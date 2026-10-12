import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UsuarioActual = { id: string; email: string | null };

// Lee cookies: usarlo dentro de un <Suspense>, una Server Action o un Route Handler.
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
