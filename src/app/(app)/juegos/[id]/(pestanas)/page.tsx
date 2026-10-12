import { CircleCheck, Clock, Gauge, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccionesCatalogo } from "@/components/juegos/acciones-catalogo";
import { EnlaceBgg } from "@/components/juegos/enlace-bgg";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { BotonLink } from "@/components/ui/boton";
import { formatearComplejidad, formatearDuracion, formatearJugadores } from "@/lib/formato";
import { urlJuegoBgg } from "@/lib/game-data/bgg/enlaces";
import { obtenerJuego } from "@/lib/juegos/consultas";

export const metadata: Metadata = { title: "Ficha" };

export default function FichaPage({ params, searchParams }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<EsqueletoFicha />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <Ficha
          id={id}
          aviso={sp.agregado === "1" ? "agregado" : sp.editado === "1" ? "editado" : null}
        />
      ))}
    </Suspense>
  );
}

const AVISOS = {
  agregado: "¡Listo! Lo agregaste a tu catálogo.",
  editado: "Guardaste los cambios.",
};

async function Ficha({ id, aviso }: { id: string; aviso: keyof typeof AVISOS | null }) {
  const resultado = await obtenerJuego(id);
  if (!resultado) notFound();
  const { juego, catalogo, editable } = resultado;

  const datos = [
    { Icono: Users, texto: formatearJugadores(juego.jugadores_min, juego.jugadores_max) },
    { Icono: Clock, texto: formatearDuracion(juego.duracion_min) },
    { Icono: Gauge, texto: formatearComplejidad(juego.complejidad) },
  ].filter((d) => d.texto);

  return (
    <article className="space-y-5">
      {aviso && (
        <p
          role="status"
          className="bg-primario/10 flex items-center gap-2 rounded-2xl p-3 text-sm font-medium"
        >
          <CircleCheck aria-hidden className="text-primario size-5" />
          {AVISOS[aviso]}
        </p>
      )}
      <ImagenJuego
        url={juego.imagen_url}
        nombre={juego.nombre}
        sizes="(min-width: 768px) 720px, 100vw"
        priority
        className="aspect-[4/3] w-full rounded-2xl"
      />

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

      {/* Cualquier juego con bgg_id: los de BGG y los manuales que lo guardan de referencia. */}
      {juego.bgg_id && <EnlaceBgg bggId={juego.bgg_id} className="print:hidden" />}

      <AccionesCatalogo
        juegoId={juego.id}
        catalogo={catalogo ? { puntuacion: catalogo.puntuacion, notas: catalogo.notas } : null}
        esManualPropio={editable}
      />

      {juego.descripcion && (
        <section className="space-y-2">
          <h2 className="font-semibold">Descripción</h2>
          <p className="text-texto-suave text-sm leading-relaxed whitespace-pre-line">
            {juego.descripcion}
          </p>
          {/* Solo se atribuye a BGG si es la fila de BGG: en un juego manual
              con bgg_id de referencia, la descripción pudo haberse editado. */}
          {juego.origen === "bgg" && juego.bgg_id && (
            <p className="text-texto-suave text-xs">
              Descripción:{" "}
              <a
                href={urlJuegoBgg(juego.bgg_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primario font-medium underline underline-offset-2"
              >
                BoardGameGeek
              </a>
            </p>
          )}
        </section>
      )}

      {editable && (
        <BotonLink
          href={`/juegos/${juego.id}/editar`}
          variante="secundario"
          className="print:hidden"
        >
          <Pencil aria-hidden className="size-4" />
          Editar datos del juego
        </BotonLink>
      )}
    </article>
  );
}

function EsqueletoFicha() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="bg-borde aspect-[4/3] w-full animate-pulse rounded-2xl" />
      <div className="bg-borde h-8 w-2/3 animate-pulse rounded-full" />
      <div className="bg-borde h-32 animate-pulse rounded-2xl" />
    </div>
  );
}
