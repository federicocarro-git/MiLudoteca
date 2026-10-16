"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { PUNTOS_MAX } from "@/lib/validations/salas";

/** − / número / + para cargar puntos. El número se puede escribir. */
export function Marcador({
  puntos,
  nombre,
  onCambiar,
}: {
  puntos: number;
  nombre: string;
  onCambiar: (puntos: number) => void;
}) {
  // Lo que se está escribiendo (puede quedar vacío o con "-" un momento).
  const [texto, setTexto] = useState<string | null>(null);

  const limitar = (n: number) => Math.max(-PUNTOS_MAX, Math.min(PUNTOS_MAX, n));

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onCambiar(limitar(puntos - 1))}
        aria-label={`Restar un punto a ${nombre}`}
        className="border-borde bg-fondo active:bg-borde inline-flex size-11 items-center justify-center rounded-full border-[1.5px]"
      >
        <Minus aria-hidden className="size-5" strokeWidth={3} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Puntos de ${nombre}`}
        value={texto ?? String(puntos)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const valor = e.target.value.replace(/[^\d-]/g, "");
          setTexto(valor);
          if (/^-?\d+$/.test(valor)) onCambiar(limitar(Number(valor)));
        }}
        onBlur={() => setTexto(null)}
        className="font-display focus-visible:outline-primario h-11 w-14 rounded-xl bg-transparent text-center text-[1.6rem] font-bold tabular-nums focus-visible:outline-2"
      />
      <button
        type="button"
        onClick={() => onCambiar(limitar(puntos + 1))}
        aria-label={`Sumar un punto a ${nombre}`}
        className="bg-primario text-sobre-primario active:bg-primario-hover relieve-primario inline-flex size-11 items-center justify-center rounded-full active:translate-y-0.5 active:shadow-none"
      >
        <Plus aria-hidden className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
}
