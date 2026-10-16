"use client";

import { Dices, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { crearSala } from "@/app/(app)/jugar/actions";
import { Boton } from "@/components/ui/boton";

/** Crea una sala con este juego, o sin juego (y lleva a ella). */
export function BotonCrearSala({
  juegoId,
  children = "Jugar una partida",
  className = "",
  variante = "primario",
}: {
  juegoId: string | null;
  variante?: "primario" | "secundario";
  children?: React.ReactNode;
  className?: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={`space-y-2 ${className}`}>
      <Boton
        variante={variante}
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await crearSala(juegoId);
            // Si sale bien, la acción redirige a la sala.
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pendiente ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Dices aria-hidden className="size-4" />
        )}
        {children}
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
