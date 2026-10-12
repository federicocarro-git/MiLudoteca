"use client";

import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { autenticarConEmail, ingresarConGoogle } from "@/app/(auth)/login/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { mensajeDeErrorAuth } from "@/lib/auth-errores";
import { LARGO_MINIMO_PASSWORD, type ModoEmail } from "@/lib/validations/auth";
import { LogoGoogle } from "./logo-google";

// Solo se muestra si Google está configurado en Supabase (ver docs/AUTH.md).
const GOOGLE_HABILITADO = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";

const TEXTO_BOTON: Record<ModoEmail, string> = {
  ingresar: "Ingresar",
  crear: "Crear cuenta",
  link: "Mandame el link",
};

export function FormularioLogin() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const errorUrl = searchParams.get("error");

  const [modo, setModo] = useState<ModoEmail>("ingresar");
  const [verPassword, setVerPassword] = useState(false);
  // Controlados: React resetea el formulario después de cada acción y, si hay
  // un error, no queremos que se borre lo que la persona escribió.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estado, accion, enviando] = useActionState(autenticarConEmail, null);

  if (estado?.ok) {
    return (
      <div role="status" className="space-y-3 text-center">
        <MailCheck aria-hidden className="text-primario mx-auto size-10" />
        <h2 className="text-lg font-semibold">Revisá tu email</h2>
        <p className="text-texto-suave text-sm">{estado.data.mensaje}</p>
        <p className="text-texto-suave text-xs">
          ¿No llegó? Mirá en spam o probá de nuevo en un minuto.
        </p>
      </div>
    );
  }

  const error =
    estado?.ok === false ? estado.error : errorUrl ? mensajeDeErrorAuth(errorUrl) : null;

  return (
    <div className="space-y-5">
      {GOOGLE_HABILITADO && (
        <>
          <form action={ingresarConGoogle}>
            <input type="hidden" name="next" value={next} />
            <Boton type="submit" variante="secundario" className="w-full">
              <LogoGoogle className="size-5" />
              Continuar con Google
            </Boton>
          </form>

          <div className="text-texto-suave flex items-center gap-3 text-xs">
            <span className="bg-borde h-px flex-1" />o con tu email
            <span className="bg-borde h-px flex-1" />
          </div>
        </>
      )}

      {modo !== "link" && (
        <div
          role="tablist"
          aria-label="Tipo de ingreso"
          className="bg-fondo grid grid-cols-2 rounded-xl p-1"
        >
          {(["ingresar", "crear"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={`min-h-10 rounded-lg text-sm font-medium ${
                modo === m ? "bg-superficie text-texto shadow-sm" : "text-texto-suave"
              }`}
            >
              {m === "ingresar" ? "Ya tengo cuenta" : "Soy nuevo"}
            </button>
          ))}
        </div>
      )}

      <form action={accion} className="space-y-4" noValidate>
        <input type="hidden" name="modo" value={modo} />
        <input type="hidden" name="next" value={next} />
        <Campo
          etiqueta="Email"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {modo !== "link" && (
          <div className="relative">
            <Campo
              etiqueta="Contraseña"
              id="password"
              name="password"
              type={verPassword ? "text" : "password"}
              autoComplete={modo === "crear" ? "new-password" : "current-password"}
              minLength={modo === "crear" ? LARGO_MINIMO_PASSWORD : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="text-texto-suave hover:text-texto absolute right-0 bottom-0 flex size-11 items-center justify-center"
            >
              {verPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
            {modo === "crear" && (
              <p className="text-texto-suave mt-1.5 text-xs">
                Mínimo {LARGO_MINIMO_PASSWORD} caracteres.
              </p>
            )}
          </div>
        )}

        {modo === "link" && (
          <p className="text-texto-suave text-sm">
            Te mandamos un link para entrar sin contraseña. Si no tenés cuenta, se crea sola.
          </p>
        )}

        <p
          aria-live="polite"
          className="min-h-5 text-sm font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>

        <Boton type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {TEXTO_BOTON[modo]}
        </Boton>
      </form>

      <button
        type="button"
        onClick={() => setModo(modo === "link" ? "ingresar" : "link")}
        className="text-primario mx-auto block min-h-11 text-sm font-medium underline-offset-4 hover:underline"
      >
        {modo === "link"
          ? "Prefiero usar contraseña"
          : "¿Te olvidaste la contraseña? Entrá con un link por email"}
      </button>
    </div>
  );
}
