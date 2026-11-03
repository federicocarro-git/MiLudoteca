"use client";

import { Check, Languages, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { elegirNombreEspanol } from "@/app/(app)/juegos/[id]/actions";
import { Hoja } from "@/components/ui/hoja";
import { ordenarNombresParaEspanol } from "@/lib/juegos/nombres";

/**
 * Para juegos de BGG: elegir con qué nombre se ve en español, entre los otros
 * nombres que tiene en BGG. Lo ven todos los que lo tienen en su estante.
 */
export function NombreEnEspanol({
  juegoId,
  nombreBgg,
  nombreActual,
  alternativos,
}: {
  juegoId: string;
  nombreBgg: string;
  nombreActual: string;
  alternativos: string[];
}) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const cambiado = nombreActual !== nombreBgg;
  const opciones = [nombreBgg, ...ordenarNombresParaEspanol(alternativos)];

  function elegir(nombre: string) {
    iniciar(async () => {
      const r = await elegirNombreEspanol(juegoId, nombre === nombreBgg ? null : nombre);
      if (r.ok) setAbierta(false);
      else setError(r.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="text-texto-suave hover:text-texto inline-flex min-h-11 items-center gap-1.5 text-sm print:hidden"
      >
        <Languages aria-hidden className="size-4" />
        {cambiado ? `En BGG: ${nombreBgg} · cambiar` : "¿Se llama distinto en español?"}
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Nombre en español">
        <div className="space-y-3">
          <p className="text-texto-suave text-sm">
            Elegí con qué nombre se ve. Son los nombres que tiene en BoardGameGeek, y el cambio lo
            ven todos los que tienen este juego.
          </p>
          <ul className="space-y-2" aria-label="Nombres en BGG">
            {opciones.map((nombre, i) => (
              <li key={nombre}>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => elegir(nombre)}
                  aria-pressed={nombre === nombreActual}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 text-left text-sm ${
                    nombre === nombreActual
                      ? "border-primario bg-primario/10 font-bold"
                      : "border-borde bg-superficie"
                  }`}
                >
                  <span className="flex-1">
                    {nombre}
                    {i === 0 && <span className="text-texto-suave"> (el de BGG)</span>}
                  </span>
                  {nombre === nombreActual && (
                    <Check aria-hidden className="text-primario size-5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="text-sm empty:hidden">
            {guardando ? (
              <span className="flex items-center gap-2">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Guardando…
              </span>
            ) : (
              error && <span className="font-medium text-red-700 dark:text-red-400">{error}</span>
            )}
          </p>
        </div>
      </Hoja>
    </>
  );
}
