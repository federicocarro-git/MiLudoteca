"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { borrarPartida } from "@/app/partida/[id]/actions";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";

/** Para el anfitrión: sacar la partida del historial de todos. */
export function BorrarPartida({ partidaId }: { partidaId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="text-texto-suave inline-flex min-h-11 items-center gap-1.5 text-sm hover:text-red-700 dark:hover:text-red-400"
      >
        <Trash2 aria-hidden className="size-4" /> Borrar partida
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Borrar la partida?">
        <div className="space-y-4">
          <p className="text-sm">
            Sale del historial de todos los que jugaron, con sus fotos y notas. No se puede
            deshacer.
          </p>
          <p
            aria-live="polite"
            className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
          >
            {error}
          </p>
          <div className="flex gap-3">
            <Boton variante="secundario" className="flex-1" onClick={() => setAbierta(false)}>
              Volver
            </Boton>
            <Boton
              className="flex-1 bg-red-700 hover:bg-red-800"
              disabled={borrando}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarPartida(partidaId);
                  // Si sale bien, la acción redirige al historial.
                  if (!r.ok) setError(r.error);
                })
              }
            >
              {borrando && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Borrar
            </Boton>
          </div>
        </div>
      </Hoja>
    </>
  );
}
