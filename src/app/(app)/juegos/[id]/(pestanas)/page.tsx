import { CircleCheck, History, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccionesCatalogo } from "@/components/juegos/acciones-catalogo";
import { EnlaceBgg } from "@/components/juegos/enlace-bgg";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { BotonCrearSala } from "@/components/salas/boton-crear-sala";
import { BotonLink } from "@/components/ui/boton";
import { formatearDuracion, jugadoresCorto, nivelDeComplejidad } from "@/lib/formato";
import { urlJuegoBgg } from "@/lib/game-data/bgg/enlaces";
import { obtenerJuego } from "@/lib/juegos/consultas";
import { obtenerJuegosDeAmigos } from "@/lib/mesa/consultas";
import { claveDeJuego } from "@/lib/mesa/juegos";
import { resumenDePartidasDelJuego } from "@/lib/partidas/consultas";
import { formatearFecha, unirNombres } from "@/lib/partidas/resultado";

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
  agregado: "¡Listo! Lo agregaste a tu estante.",
  editado: "Guardaste los cambios.",
};

async function Ficha({ id, aviso }: { id: string; aviso: keyof typeof AVISOS | null }) {
  const resultado = await obtenerJuego(id);
  if (!resultado) notFound();
  const { juego, catalogo, editable } = resultado;

  const datos = [
    { etiqueta: "Jugadores", valor: jugadoresCorto(juego.jugadores_min, juego.jugadores_max) },
    { etiqueta: "Duración", valor: formatearDuracion(juego.duracion_min) },
    { etiqueta: "Peso", valor: nivelDeComplejidad(juego.complejidad) },
  ].filter((d) => d.valor);

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
        className="aspect-[4/3] w-full rounded-[1.5rem]"
      />

      {datos.length > 0 && (
        <dl className="grid grid-cols-3 gap-2">
          {datos.map(({ etiqueta, valor }) => (
            <div
              key={etiqueta}
              className="bg-superficie border-borde rounded-2xl border-[1.5px] px-2 py-2.5 text-center"
            >
              <dt className="text-texto-suave text-[0.7rem] font-extrabold tracking-wider uppercase">
                {etiqueta}
              </dt>
              <dd className="font-display text-lg leading-tight font-bold">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {juego.tipos.length > 0 && (
        <p className="text-texto-suave text-sm">{juego.tipos.join(" · ")}</p>
      )}

      {/* Cualquier juego con bgg_id: los de BGG y los manuales que lo guardan de referencia. */}
      {juego.bgg_id && <EnlaceBgg bggId={juego.bgg_id} className="print:hidden" />}

      <section className="space-y-2 print:hidden" aria-label="Partidas">
        <BotonCrearSala juegoId={juego.id} />
        <Suspense fallback={<p className="bg-borde h-5 w-48 animate-pulse rounded" />}>
          <PartidasDelJuego juegoId={juego.id} />
        </Suspense>
        <Suspense>
          <AmigosQueLoTienen juego={juego} />
        </Suspense>
      </section>

      <AccionesCatalogo
        juegoId={juego.id}
        catalogo={catalogo ? { puntuacion: catalogo.puntuacion, notas: catalogo.notas } : null}
        esManualPropio={editable}
      />

      {juego.descripcion && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Descripción</h2>
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

async function PartidasDelJuego({ juegoId }: { juegoId: string }) {
  const { cantidad, ultima } = await resumenDePartidasDelJuego(juegoId);
  if (cantidad === 0) {
    return <p className="text-texto-suave text-sm">Todavía no lo jugaste con MiLudoteca.</p>;
  }
  return (
    <p className="text-sm">
      <Link
        href={`/jugar/historial?juego=${juegoId}`}
        className="text-primario inline-flex min-h-11 items-center gap-1 font-medium"
      >
        <History aria-hidden className="size-4" />
        {cantidad === 1 ? "Lo jugaste 1 vez" : `Lo jugaste ${cantidad} veces`}
        {ultima ? ` · la última, el ${formatearFecha(ultima)}` : ""}
      </Link>
    </p>
  );
}

async function AmigosQueLoTienen({ juego }: { juego: { bgg_id: number | null; nombre: string } }) {
  const clave = claveDeJuego(juego);
  const coincide = (await obtenerJuegosDeAmigos()).find((j) => j.clave === clave);
  if (!coincide) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Users aria-hidden className="text-primario size-4" />
      <span>
        <span className="text-texto-suave">También lo tiene </span>
        {unirNombres(coincide.duenos.map((d) => d.nombre))}
      </span>
    </p>
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
