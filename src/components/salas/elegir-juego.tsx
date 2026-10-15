"use client";

import { ChevronRight, Loader2, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { crearSala } from "@/app/(app)/jugar/actions";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { normalizar } from "@/lib/game-data/texto";
import { formatearJugadores } from "@/lib/formato";

export type JuegoParaSala = {
  id: string;
  nombre: string;
  imagen_url: string | null;
  jugadores_min: number | null;
  jugadores_max: number | null;
};

/** Lista del catálogo con buscador: tocar un juego crea la sala. */
export function ElegirJuego({ juegos }: { juegos: JuegoParaSala[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return q ? juegos.filter((j) => normalizar(j.nombre).includes(q)) : juegos;
  }, [busqueda, juegos]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden
          className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar en tu catálogo"
          placeholder="Buscar en tu catálogo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border-borde bg-superficie focus-visible:outline-primario block min-h-11 w-full rounded-xl border pr-3 pl-10 text-base focus-visible:outline-2"
        />
      </div>
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
      {visibles.length === 0 ? (
        <p className="text-texto-suave text-sm">Ningún juego de tu catálogo coincide.</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                disabled={creando !== null}
                onClick={() => {
                  setCreando(j.id);
                  iniciar(async () => {
                    const r = await crearSala(j.id);
                    // Si sale bien, la acción redirige a la sala.
                    if (!r.ok) {
                      setError(r.error);
                      setCreando(null);
                    }
                  });
                }}
                className="border-borde bg-superficie hover:border-primario flex w-full items-center gap-3 rounded-2xl border p-2 text-left disabled:opacity-60"
              >
                <ImagenJuego
                  url={j.imagen_url}
                  nombre={j.nombre}
                  sizes="56px"
                  className="size-14 shrink-0 rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{j.nombre}</span>
                  <span className="text-texto-suave block text-sm">
                    {formatearJugadores(j.jugadores_min, j.jugadores_max) ?? " "}
                  </span>
                </span>
                {creando === j.id ? (
                  <Loader2 aria-hidden className="text-primario size-5 animate-spin" />
                ) : (
                  <ChevronRight aria-hidden className="text-texto-suave size-5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
