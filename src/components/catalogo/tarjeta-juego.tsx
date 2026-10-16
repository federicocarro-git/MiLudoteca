import { Clock, Star, Users } from "lucide-react";
import Link from "next/link";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import type { JuegoCatalogo } from "@/lib/catalogo/filtros";
import { formatearDuracion, jugadoresCorto, nivelDeComplejidad } from "@/lib/formato";

export function TarjetaJuego({
  juego,
  prioridad = false,
}: {
  juego: JuegoCatalogo;
  prioridad?: boolean;
}) {
  const jugadores = jugadoresCorto(juego.jugadores_min, juego.jugadores_max);
  const duracion = formatearDuracion(juego.duracion_min);
  const nivel = nivelDeComplejidad(juego.complejidad);

  return (
    <Link
      href={`/juegos/${juego.id}`}
      className="border-borde bg-superficie focus-visible:outline-primario relieve group block rounded-[1.25rem] border-[1.5px] p-2 focus-visible:outline-2"
    >
      <div className="relative">
        <ImagenJuego
          url={juego.imagen_url}
          nombre={juego.nombre}
          sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={prioridad}
          className="aspect-square w-full rounded-xl"
        />
        {juego.puntuacion && (
          <span className="bg-superficie/90 absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
            <Star aria-hidden className="fill-miel text-miel size-3" />
            <span className="sr-only">Tu puntuación: </span>
            {juego.puntuacion}
          </span>
        )}
      </div>
      <div className="space-y-1 px-1 pt-2 pb-1">
        <h3 className="font-display line-clamp-2 leading-tight font-semibold group-hover:underline">
          {juego.nombre}
        </h3>
        <p className="text-texto-suave flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-bold">
          {jugadores && (
            <span className="flex items-center gap-1">
              <Users aria-hidden className="size-3.5" />
              <span className="sr-only">Jugadores: </span>
              {jugadores}
            </span>
          )}
          {duracion && (
            <span className="flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" />
              <span className="sr-only">Duración: </span>
              {duracion}
            </span>
          )}
          {nivel && <span>{nivel}</span>}
        </p>
      </div>
    </Link>
  );
}
