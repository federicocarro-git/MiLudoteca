import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { esRutaPublica } from "@/lib/rutas";

// Refresca la sesión de Supabase en cada request y manda a /login a quien
// entra sin sesión a una ruta protegida. Es un chequeo optimista: la
// autorización real la hacen RLS y cada Server Action.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // No meter código entre createServerClient y getClaims(): getClaims()
  // es lo que valida el JWT y dispara el refresco de la sesión.
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!conSesion && !esRutaPublica(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", `${pathname}${search}`);
    return redirectConCookies(login, response);
  }

  if (conSesion && pathname === "/login") {
    const inicio = request.nextUrl.clone();
    inicio.pathname = "/catalogo";
    inicio.search = "";
    return redirectConCookies(inicio, response);
  }

  return response;
}

// Un redirect tiene que llevar las cookies que Supabase haya refrescado.
function redirectConCookies(destino: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(destino);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "location" && key.toLowerCase() !== "set-cookie") {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
