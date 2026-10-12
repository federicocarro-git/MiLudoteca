import { CircleCheck, Clock, Gauge, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { formatearComplejidad, formatearDuracion, formatearJugadores } from "@/lib/formato";
import { obtenerJuego } from "@/lib/juegos/consultas";

export const metadata: Metadata = { title: "Juego" };

// Ficha básica. El hito 6 agrega las pestañas "Cómo se juega" y "Hoja de turno".
export default function JuegoPage({ params, searchParams }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <Ficha id={id} agregado={sp.agregado === "1"} />
      ))}
    </Suspense>
  );
}

async function Ficha({ id, agregado }: { id: string; agregado: boolean }) {
  const resultado = await obtenerJuego(id);
  if (!resultado) notFound();
  const { juego, catalogo } = resultado;

  const datos = [
    { Icono: Users, texto: formatearJugadores(juego.jugadores_min, juego.jugadores_max) },
    { Icono: Clock, texto: formatearDuracion(juego.duracion_min) },
    { Icono: Gauge, texto: formatearComplejidad(juego.complejidad) },
  ].filter((d) => d.texto);

  return (
    <article className="space-y-5">
      {agregado && (
        <p
          role="status"
          className="bg-primario/10 flex items-center gap-2 rounded-2xl p-3 text-sm font-medium"
        >
          <CircleCheck aria-hidden className="text-primario size-5" />
          ¡Listo! Lo agregaste a tu catálogo.
        </p>
      )}
      <ImagenJuego
        url={juego.imagen_url}
        nombre={juego.nombre}
        sizes="(min-width: 768px) 720px, 100vw"
        priority
        className="aspect-[4/3] w-full rounded-2xl"
      />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{juego.nombre}</h1>
        {juego.anio && <p className="text-texto-suave">{juego.anio}</p>}
      </header>

      {datos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {datos.map(({ Icono, texto }) => (
            <li
              key={texto}
              className="bg-superficie border-borde flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            >
              <Icono aria-hidden className="text-primario size-4" />
              {texto}
            </li>
          ))}
        </ul>
      )}

      {juego.tipos.length > 0 && (
        <p className="text-texto-suave text-sm">{juego.tipos.join(" · ")}</p>
      )}

      {catalogo && (catalogo.puntuacion || catalogo.notas) && (
        <section className="border-borde bg-superficie space-y-2 rounded-2xl border p-4">
          <h2 className="font-semibold">En tu catálogo</h2>
          {catalogo.puntuacion && (
            <p className="flex items-center gap-1.5 text-sm">
              <Star aria-hidden className="size-4 fill-amber-400 text-amber-400" />
              Tu puntuación: <strong>{catalogo.puntuacion}/10</strong>
            </p>
          )}
          {catalogo.notas && <p className="text-sm whitespace-pre-line">{catalogo.notas}</p>}
        </section>
      )}

      {juego.descripcion && (
        <section className="space-y-2">
          <h2 className="font-semibold">Descripción</h2>
          <p className="text-texto-suave text-sm leading-relaxed whitespace-pre-line">
            {juego.descripcion}
          </p>
        </section>
      )}

      {juego.origen === "bgg" && (
        <p className="text-texto-suave text-xs">Datos de BoardGameGeek.</p>
      )}
    </article>
  );
}

function EsqueletoFicha() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="bg-borde aspect-[4/3] w-full animate-pulse rounded-2xl" />
      <div className="bg-borde h-7 w-2/3 animate-pulse rounded" />
      <div className="bg-borde h-5 w-1/2 animate-pulse rounded" />
    </div>
  );
}
