"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { guardarNotas, type EstadoNotas } from "@/app/partida/[id]/actions";
import { Boton } from "@/components/ui/boton";
import { AreaTexto } from "@/components/ui/campo";

/** Notas de la partida: el anfitrión las escribe; los demás las leen. */
export function NotasPartida({
  partidaId,
  notas: inicial,
  editable,
}: {
  partidaId: string;
  notas: string | null;
  editable: boolean;
}) {
  const [notas, setNotas] = useState(inicial ?? "");
  const [estado, accion, guardando] = useActionState(
    (previo: EstadoNotas, fd: FormData) => guardarNotas(partidaId, previo, fd),
    null,
  );

  if (!editable) {
    return inicial ? (
      <p className="text-sm whitespace-pre-line">{inicial}</p>
    ) : (
      <p className="text-texto-suave text-sm">Sin notas.</p>
    );
  }

  return (
    <form action={accion} className="space-y-3" noValidate>
      <AreaTexto
        etiqueta="Notas de la partida"
        id="notas-partida"
        name="notas"
        rows={3}
        maxLength={2000}
        placeholder="Ej.: Beto ganó en la última ronda, revancha el sábado…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        error={estado?.ok === false ? estado.errores?.notas : undefined}
      />
      <p aria-live="polite" className="text-sm font-medium empty:hidden">
        {estado?.ok === true ? "Guardaste las notas." : null}
        {estado?.ok === false && !estado.errores ? (
          <span className="text-red-700 dark:text-red-400">{estado.error}</span>
        ) : null}
      </p>
      <Boton
        type="submit"
        variante="secundario"
        disabled={guardando || notas.trim() === (inicial ?? "")}
      >
        {guardando && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Guardar notas
      </Boton>
    </form>
  );
}
