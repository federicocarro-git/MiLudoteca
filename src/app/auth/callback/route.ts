import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

// Vuelta del OAuth (Google) y de los links de email con flujo PKCE (?code=).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  let codigoError = searchParams.get("error_code") ?? searchParams.get("error") ?? "link_invalido";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    codigoError = error.code ?? "link_invalido";
  }

  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(codigoError)}`, origin));
}
