"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { Selector } from "@/components/ui/campo";
import { formatearDuracion, formatearJugadores } from "@/lib/formato";
import { unirNombres } from "@/lib/partidas/resultado";
import { filtrarJuegosDeAmigos, type JuegoConDuenos } from "@/lib/mesa/juegos";

/** Juegos de tus amigos, con buscador y filtro por amigo. */
export function QuienLoTiene({
  juegos,
  amigos,
}: {
  juegos: JuegoConDuenos[];
  amigos: { id: string; nombre: string }[];
}) {
  const [q, setQ] = useState("");
  const [amigo, setAmigo] = useState("");
  const visibles = filtrarJuegosDeAmigos(juegos, { q, amigo: amigo || null });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden
          className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar un juego"
          placeholder="Buscar un juego"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-borde bg-superficie focus-visible:outline-primario block min-h-11 w-full rounded-xl border pr-3 pl-10 text-base focus-visible:outline-2"
        />
      </div>
      {amigos.length > 1 && (
        <Selector
          etiqueta="Amigo"
          id="filtro-amigo"
          value={amigo}
          onChange={(e) => setAmigo(e.target.value)}
        >
          <option value="">Todos</option>
          {amigos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>
      )}

      <p className="text-texto-suave text-sm" aria-live="polite">
        {visibles.length === 1 ? "1 juego" : `${visibles.length} juegos`}
      </p>

      <ul className="space-y-2" aria-label="Juegos de tus amigos">
        {visibles.map((j) => {
          const detalle = [
            formatearJugadores(j.jugadores_min, j.jugadores_max),
            formatearDuracion(j.duracion_min),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={j.clave}
              aria-label={j.nombre}
              className="border-borde bg-superficie relieve flex items-center gap-3 rounded-2xl border p-2"
            >
              <ImagenJuego
                url={j.imagen_url}
                nombre={j.nombre}
                sizes="56px"
                className="size-14 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{j.nombre}</p>
                {detalle && <p className="text-texto-suave text-xs">{detalle}</p>}
                <p className="text-sm">
                  <span className="text-texto-suave">Lo tiene </span>
                  {unirNombres(j.duenos.map((d) => d.nombre))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
