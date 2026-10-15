"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cambiarVisibilidadCatalogo } from "@/app/(app)/cuenta/actions";

/** Interruptor: ¿tus amigos y la mesa de una sala ven tus juegos? */
export function VisibilidadCatalogo({ visible }: { visible: boolean }) {
  const [optimista, setOptimista] = useOptimistic(visible);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  return (
    <div className="space-y-1">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="text-sm">
          <span className="block font-medium">Mostrar mis juegos</span>
          <span className="text-texto-suave block text-xs">
            Tus amigos los ven en &quot;¿Quién lo tiene?&quot; y la mesa de una sala los usa para
            &quot;¿A qué jugamos?&quot;. Tus notas y puntuaciones nunca se muestran.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={optimista}
          onChange={(e) => {
            const nuevo = e.target.checked;
            iniciar(async () => {
              setOptimista(nuevo);
              const r = await cambiarVisibilidadCatalogo(nuevo);
              setError(r.ok ? null : r.error);
            });
          }}
          className="accent-primario size-6 shrink-0"
        />
      </label>
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
    </div>
  );
}
