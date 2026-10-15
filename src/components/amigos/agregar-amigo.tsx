"use client";

import { CircleCheck, Loader2, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { agregarAmigo, type EstadoAgregarAmigo } from "@/app/(app)/jugar/amigos/actions";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";

/** Formulario para mandar una solicitud con el código de otra persona. */
export function AgregarAmigo({ codigoInicial = "" }: { codigoInicial?: string }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoAgregarAmigo, fd: FormData) => {
      const r = await agregarAmigo(previo, fd);
      if (r?.ok) setCodigo("");
      return r;
    },
    null,
  );

  return (
    <form action={accion} className="space-y-3" noValidate>
      <Campo
        etiqueta="Código de tu amigo"
        id="codigo"
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
      <div aria-live="polite">
        {estado?.ok === true && (
          <p className="bg-primario/10 flex items-center gap-2 rounded-2xl p-3 text-sm font-medium">
            <CircleCheck aria-hidden className="text-primario size-5 shrink-0" />
            {estado.data}
          </p>
        )}
        {estado?.ok === false && !estado.errores && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{estado.error}</p>
        )}
      </div>
      <Boton type="submit" disabled={enviando}>
        {enviando ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <UserPlus aria-hidden className="size-4" />
        )}
        Mandar solicitud
      </Boton>
    </form>
  );
}
