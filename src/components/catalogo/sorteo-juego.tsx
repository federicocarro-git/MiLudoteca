"use client";

import { Dices, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { elegirAlAzar, type JuegoCatalogo } from "@/lib/catalogo/filtros";
import { formatearDuracion, formatearJugadores } from "@/lib/formato";

const DURACION_GIRO_MS = 900;
const PASO_GIRO_MS = 90;

/** La pizarra "¿A qué jugamos hoy?": sortea entre los juegos que se ven. */
export function SorteoJuego({ juegos }: { juegos: JuegoCatalogo[] }) {
  const [abierta, setAbierta] = useState(false);
  const [elegido, setElegido] = useState<JuegoCatalogo | null>(null);
  const [girando, setGirando] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function sortear(anterior?: string) {
    const resultado = elegirAlAzar(juegos, anterior);
    if (!resultado) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const sinAnimacion =
      juegos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinAnimacion) {
      setElegido(resultado);
      return;
    }
    // Pasan nombres al azar durante un instante, como una ruleta.
    setElegido(null);
    for (let t = 0; t < DURACION_GIRO_MS; t += PASO_GIRO_MS) {
      timers.current.push(
        window.setTimeout(
          () => setGirando(juegos[Math.floor(Math.random() * juegos.length)].nombre),
          t,
        ),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setGirando(null);
        setElegido(resultado);
      }, DURACION_GIRO_MS),
    );
  }

  function abrir() {
    setAbierta(true);
    sortear();
  }

  const detalle = elegido
    ? [
        formatearJugadores(elegido.jugadores_min, elegido.jugadores_max),
        formatearDuracion(elegido.duracion_min),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <>
      <section
        aria-labelledby="titulo-pizarra"
        className="bg-pizarra text-tiza border-marco relative overflow-hidden rounded-[1.25rem] border-[6px] px-4 py-3.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] print:hidden"
      >
        <h2 id="titulo-pizarra" className="font-mano text-[1.9rem] leading-none font-semibold">
          ¿A qué jugamos hoy?
        </h2>
        <p className="mt-1 text-sm opacity-80">
          {juegos.length === 0
            ? "Ningún juego pasa los filtros de abajo."
            : `Sorteo entre ${juegos.length === 1 ? "el juego" : `los ${juegos.length} juegos`} que ves abajo.`}
        </p>
        <button
          type="button"
          onClick={abrir}
          disabled={juegos.length === 0}
          className="bg-miel mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-extrabold text-[#3a2a1f] shadow-[0_3px_0_rgb(0_0_0/0.35)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-50"
        >
          <Dices aria-hidden className="size-5" />
          Sortear
        </button>
      </section>

      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿A qué jugamos?">
        <div
          aria-live="polite"
          className="flex min-h-72 flex-col items-center justify-center gap-4 text-center"
        >
          {girando && (
            <p className="text-texto-suave animate-pulse text-xl font-semibold">{girando}</p>
          )}
          {elegido && !girando && (
            <>
              <p className="text-texto-suave text-sm">Hoy se juega…</p>
              <Link href={`/juegos/${elegido.id}`} className="block w-40">
                <ImagenJuego
                  url={elegido.imagen_url}
                  nombre={elegido.nombre}
                  sizes="160px"
                  className="aspect-square w-40 rounded-2xl"
                />
              </Link>
              <div>
                <p className="font-display text-2xl font-bold">{elegido.nombre}</p>
                {detalle && <p className="text-texto-suave text-sm">{detalle}</p>}
              </div>
              <div className="flex w-full gap-3">
                <Boton
                  variante="secundario"
                  onClick={() => sortear(elegido.id)}
                  disabled={juegos.length < 2}
                  className="flex-1"
                >
                  <RefreshCw aria-hidden className="size-4" />
                  Otro
                </Boton>
                <BotonLink href={`/juegos/${elegido.id}`} className="flex-1">
                  Ver ficha
                </BotonLink>
              </div>
              {juegos.length < 2 && (
                <p className="text-texto-suave text-xs">
                  Es el único juego que cumple los filtros.
                </p>
              )}
            </>
          )}
        </div>
      </Hoja>
    </>
  );
}
