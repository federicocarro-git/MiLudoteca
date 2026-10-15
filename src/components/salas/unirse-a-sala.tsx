"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import {
  entrarComoInvitado,
  unirmeConMiCuenta,
  type EstadoNombreJugador,
} from "@/app/sala/[codigo]/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

/** Con cuenta: un botón para entrar con el nombre del perfil. */
export function UnirmeConMiCuenta({ codigo }: { codigo: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Boton
        className="w-full"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await unirmeConMiCuenta(codigo);
            setError(r.ok ? null : r.error);
          })
        }
      >
        {pendiente ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <LogIn aria-hidden className="size-4" />
        )}
        Unirme a la sala
      </Boton>
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
    </div>
  );
}

/** Sin cuenta: entrar como invitado con un nombre. */
export function EntrarComoInvitado({ codigo }: { codigo: string }) {
  const [nombre, setNombre] = useState("");
  const [estado, accion, entrando] = useActionState(
    (previo: EstadoNombreJugador, fd: FormData) => entrarComoInvitado(codigo, previo, fd),
    null,
  );
  return (
    <form action={accion} className="space-y-3" noValidate>
      <Campo
        etiqueta="Tu nombre"
        id="nombre-invitado"
        name="nombre"
        maxLength={40}
        autoComplete="given-name"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={estado?.ok === false ? estado.errores?.nombre : undefined}
        ayuda="Así te van a ver los demás en esta partida."
      />
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {estado?.ok === false && !estado.errores ? estado.error : null}
      </p>
      <Boton type="submit" className="w-full" disabled={entrando}>
        {entrando && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Entrar como invitado
      </Boton>
    </form>
  );
}
