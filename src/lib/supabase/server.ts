import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "./database.types";

// Crear uno por request: nunca compartirlo entre requests.
// Lee cookies(), así que con Cache Components quien lo use tiene que estar
// dentro de un <Suspense> (o en una Server Action / Route Handler).
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component, que no puede escribir cookies.
          // No pasa nada: el proxy ya refresca la sesión en cada request.
        }
      },
    },
  });
}
