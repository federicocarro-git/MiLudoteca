"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState, useState } from "react";
import { irASala, type EstadoIrASala } from "@/app/(app)/jugar/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

export function UnirseConCodigo() {
  const [codigo, setCodigo] = useState("");
  const [estado, accion, buscando] = useActionState(
    (previo: EstadoIrASala, fd: FormData) => irASala(previo, fd),
    null,
  );
  return (
    <form action={accion} className="space-y-3" noValidate>
      <Campo
        etiqueta="Código de la sala"
        id="codigo-sala"
        name="codigo"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        placeholder="Ej.: K7Q4MX"
        className="font-mono tracking-widest uppercase"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        error={estado?.ok === false ? estado.errores?.codigo : undefined}
      />
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {estado?.ok === false && !estado.errores ? estado.error : null}
      </p>
      <Boton type="submit" variante="secundario" disabled={buscando}>
        {buscando ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <LogIn aria-hidden className="size-4" />
        )}
        Unirme
      </Boton>
    </form>
  );
}
