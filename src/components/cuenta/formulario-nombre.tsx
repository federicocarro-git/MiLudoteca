"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { actualizarNombre, type EstadoNombre } from "@/app/(app)/cuenta/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

export function FormularioNombre({ nombre: inicial }: { nombre: string }) {
  const [nombre, setNombre] = useState(inicial);
  const [estado, accion, guardando] = useActionState(
    (previo: EstadoNombre, fd: FormData) => actualizarNombre(previo, fd),
    null,
  );

  return (
    <form action={accion} className="space-y-3" noValidate>
      <Campo
        etiqueta="Tu nombre"
        id="nombre"
        name="nombre"
        required
        maxLength={40}
        autoComplete="nickname"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={estado?.ok === false ? estado.errores?.nombre : undefined}
        ayuda="Así te ven tus amigos y los demás jugadores de una sala."
      />
      <p aria-live="polite" className="text-sm font-medium empty:hidden">
        {estado?.ok === true ? "Guardaste tu nombre." : null}
        {estado?.ok === false && !estado.errores ? (
          <span className="text-red-700 dark:text-red-400">{estado.error}</span>
        ) : null}
      </p>
      <Boton type="submit" variante="secundario" disabled={guardando || nombre.trim() === inicial}>
        {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Guardar nombre
      </Boton>
    </form>
  );
}
