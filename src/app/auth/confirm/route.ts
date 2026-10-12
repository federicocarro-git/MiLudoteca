import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RUTA_INICIO } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

const TIPOS_VALIDOS: EmailOtpType[] = ["email", "signup", "magiclink", "invite", "email_change"];

// Destino de los links de los emails (confirmar cuenta y link mágico).
// - ?token_hash=...&type=...: plantillas propias (supabase/templates). Funciona
//   aunque el link se abra en otro navegador o en la app de mail.
// - ?code=...: plantillas por defecto de Supabase (flujo PKCE). Solo funciona en
//   el mismo navegador donde se pidió el link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createClient();

  let codigoError = searchParams.get("error_code") ?? "link_invalido";

  if (tokenHash && tipo && TIPOS_VALIDOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(RUTA_INICIO, origin));
    codigoError = error.code ?? codigoError;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(RUTA_INICIO, origin));
    codigoError = error.code ?? codigoError;
  }

  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(codigoError)}`, origin));
}
