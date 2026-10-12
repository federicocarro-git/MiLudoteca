"use client";

import { Dices, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { BotonLink } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { elegirAlAzar, type JuegoCatalogo } from "@/lib/catalogo/filtros";
import { formatearDuracion, formatearJugadores } from "@/lib/formato";

const DURACION_GIRO_MS = 900;
const PASO_GIRO_MS = 90;

/** Botón flotante "¿A qué jugamos?": sortea entre los juegos que se ven. */
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
      <button
        type="button"
        onClick={abrir}
        disabled={juegos.length === 0}
        className="bg-primario text-sobre-primario hover:bg-primario-hover fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center gap-2 rounded-full px-5 font-semibold shadow-lg transition-transform active:scale-95 disabled:opacity-50 print:hidden"
      >
        <Dices aria-hidden className="size-6" />
        ¿A qué jugamos?
      </button>

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
                <p className="text-2xl font-bold tracking-tight">{elegido.nombre}</p>
                {detalle && <p className="text-texto-suave text-sm">{detalle}</p>}
              </div>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => sortear(elegido.id)}
                  disabled={juegos.length < 2}
                  className="border-borde hover:bg-fondo inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-50"
                >
                  <RefreshCw aria-hidden className="size-4" />
                  Otro
                </button>
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
