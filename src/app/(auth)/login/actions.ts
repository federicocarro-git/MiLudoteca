"use server";

import { redirect } from "next/navigation";
import { mensajeDeErrorAuth } from "@/lib/auth-errores";
import type { Resultado } from "@/lib/resultado";
import { destinoSeguro } from "@/lib/rutas";
import { urlDelSitio } from "@/lib/sitio";
import { createClient } from "@/lib/supabase/server";
import { formularioEmailSchema } from "@/lib/validations/auth";

export type EstadoFormularioEmail = Resultado<{ mensaje: string }> | null;

// Un solo punto de entrada para el formulario de email: ingresar con
// contraseña, crear cuenta o pedir un link mágico.
export async function autenticarConEmail(
  _previo: EstadoFormularioEmail,
  formData: FormData,
): Promise<EstadoFormularioEmail> {
  const parseo = formularioEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Revisá los datos." };
  }
  const datos = parseo.data;
  const supabase = await createClient();
  // Los links de email no llevan `next`: siempre terminan en el catálogo.
  const emailRedirectTo = `${urlDelSitio()}/auth/confirm`;

  switch (datos.modo) {
    case "ingresar": {
      const { error } = await supabase.auth.signInWithPassword({
        email: datos.email,
        password: datos.password,
      });
      if (error) return { ok: false, error: mensajeDeErrorAuth(error.code) };
      redirect(destinoSeguro(datos.next));
    }

    case "crear": {
      const { data, error } = await supabase.auth.signUp({
        email: datos.email,
        password: datos.password,
        options: { emailRedirectTo },
      });
      if (error) return { ok: false, error: mensajeDeErrorAuth(error.code) };
      // Sin confirmación de email (no debería pasar en producción) ya hay sesión.
      if (data.session) redirect(destinoSeguro(datos.next));
      // Si el email ya tenía cuenta, Supabase responde igual (no revela que
      // existe): el mensaje tiene que servir para los dos casos.
      return {
        ok: true,
        data: {
          mensaje: `Te mandamos un email a ${datos.email} para confirmar la cuenta. Abrí el link y listo.`,
        },
      };
    }

    case "link": {
      const { error } = await supabase.auth.signInWithOtp({
        email: datos.email,
        options: { emailRedirectTo, shouldCreateUser: true },
      });
      if (error) return { ok: false, error: mensajeDeErrorAuth(error.code) };
      return {
        ok: true,
        data: {
          mensaje: `Te mandamos un link a ${datos.email}. Abrilo desde este dispositivo o cualquier otro.`,
        },
      };
    }
  }
}

export async function ingresarConGoogle(formData: FormData) {
  const next = destinoSeguro(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${urlDelSitio()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.code ?? "provider_disabled")}`);
  }
  redirect(data.url);
}
