import { CalendarDays, Clock, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { BorrarPartida } from "@/components/partidas/borrar-partida";
import { FotosPartida } from "@/components/partidas/fotos-partida";
import { NotasPartida } from "@/components/partidas/notas-partida";
import { TablaResultado } from "@/components/partidas/tabla-resultado";
import { BotonCrearSala } from "@/components/salas/boton-crear-sala";
import { getSesionActual } from "@/lib/auth";
import { formatearDuracion } from "@/lib/formato";
import { obtenerJuego } from "@/lib/juegos/consultas";
import { listarFotos, obtenerPartida } from "@/lib/partidas/consultas";
import {
  NOMBRE_MODO,
  formatearFecha,
  minutosDePartida,
  textoResultado,
  type ModoResultado,
} from "@/lib/partidas/resultado";

export const metadata: Metadata = { title: "Partida" };

const TARJETA = "border-borde bg-superficie space-y-3 rounded-2xl border p-4";

export default function PartidaPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<EsqueletoPartida />}>
      {params.then(({ id }) => (
        <ContenidoPartida id={id} />
      ))}
    </Suspense>
  );
}

async function ContenidoPartida({ id }: { id: string }) {
  const [sesion, datos] = await Promise.all([getSesionActual(), obtenerPartida(id)]);
  const conCuenta = sesion !== null && !sesion.anonimo;

  if (!datos) {
    return (
      <section className="border-borde bg-superficie mx-auto max-w-md space-y-3 rounded-2xl border p-6 text-center">
        <h1 className="text-xl font-bold">No encontramos esa partida</h1>
        <p className="text-texto-suave text-sm">
          Puede que se haya borrado o que no hayas jugado en ella.
        </p>
        <Link
          href={conCuenta ? "/jugar/historial" : "/login"}
          className="text-primario inline-flex min-h-11 items-center font-semibold"
        >
          {conCuenta ? "Ir al historial" : "Ir a MiLudoteca"}
        </Link>
      </section>
    );
  }

  const { partida, jugadores } = datos;
  // Si alguien abre el link de una sala que sigue en curso, a la sala.
  if (partida.estado === "en_curso") {
    return (
      <section className="border-borde bg-superficie mx-auto max-w-md space-y-3 rounded-2xl border p-6 text-center">
        <h1 className="text-xl font-bold">La partida sigue en curso</h1>
        <Link
          href={`/sala/${partida.codigo}`}
          className="text-primario inline-flex min-h-11 items-center font-semibold"
        >
          Ir a la sala
        </Link>
      </section>
    );
  }

  const yo = sesion?.id ?? null;
  const soyAnfitrion = yo !== null && partida.anfitrion_id === yo;
  const [fotos, juegoVisible] = await Promise.all([
    listarFotos(partida.id),
    // "Jugar otra vez" solo si el anfitrión puede ver el juego (no si la sala
    // se pasó a un juego manual de un amigo).
    soyAnfitrion && partida.juego_id ? obtenerJuego(partida.juego_id) : null,
  ]);
  const minutos = minutosDePartida(partida.creada_en, partida.terminada_en);
  const cooperativo = partida.modo_resultado === "cooperativo";
  const resultado = textoResultado({ ...partida, jugadores });

  return (
    <div className="space-y-4">
      {conCuenta && <EnlaceVolver href="/jugar/historial">Historial</EnlaceVolver>}
      <header className="flex items-center gap-3">
        <ImagenJuego
          url={partida.juego_imagen_url}
          nombre={partida.juego_nombre}
          sizes="64px"
          className="size-16 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{partida.juego_nombre}</h1>
          <p className="text-texto-suave flex flex-wrap items-center gap-x-3 text-sm">
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden className="size-4" />
              {formatearFecha(partida.terminada_en ?? partida.creada_en)}
            </span>
            {minutos && (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-4" />
                {formatearDuracion(minutos)}
              </span>
            )}
          </p>
        </div>
      </header>

      <section
        className="flex items-center gap-3 rounded-2xl bg-amber-100 p-4 dark:bg-amber-950"
        aria-label="Resultado de la partida"
      >
        <Crown aria-hidden className="size-8 shrink-0 fill-amber-400 text-amber-500" />
        <div>
          <p className="text-lg font-bold">{resultado}</p>
          {partida.modo_resultado && (
            <p className="text-texto-suave text-sm">
              {NOMBRE_MODO[partida.modo_resultado as ModoResultado]}
            </p>
          )}
        </div>
      </section>

      <TablaResultado jugadores={jugadores} cooperativo={cooperativo} yo={yo} />

      <section className={TARJETA} aria-labelledby="titulo-notas">
        <h2 id="titulo-notas" className="font-semibold">
          Notas
        </h2>
        <NotasPartida partidaId={partida.id} notas={partida.notas} editable={soyAnfitrion} />
      </section>

      <section className={TARJETA} aria-labelledby="titulo-fotos">
        <h2 id="titulo-fotos" className="font-semibold">
          Fotos
        </h2>
        <FotosPartida
          partidaId={partida.id}
          fotos={fotos}
          yo={yo}
          puedeSubir={conCuenta}
          soyAnfitrion={soyAnfitrion}
        />
      </section>

      {soyAnfitrion && juegoVisible && partida.juego_id && (
        <BotonCrearSala juegoId={partida.juego_id}>Jugar otra vez</BotonCrearSala>
      )}

      {!conCuenta && (
        <p className="text-texto-suave text-center text-sm">
          Jugaste como invitado: esta partida no queda guardada para vos.{" "}
          <Link href="/login" className="text-primario font-semibold">
            Creá tu cuenta
          </Link>{" "}
          para tener tu historial y tus victorias.
        </p>
      )}

      {soyAnfitrion && (
        <div className="pt-2">
          <BorrarPartida partidaId={partida.id} />
        </div>
      )}
    </div>
  );
}

function EsqueletoPartida() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="bg-borde h-16 w-2/3 animate-pulse rounded-xl" />
      <div className="bg-borde h-20 animate-pulse rounded-2xl" />
      <div className="bg-borde h-40 animate-pulse rounded-2xl" />
    </div>
  );
}
