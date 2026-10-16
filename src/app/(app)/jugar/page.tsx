import { ChevronRight, History, PackageSearch, Plus, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { BotonCrearSala } from "@/components/salas/boton-crear-sala";
import { UnirseConCodigo } from "@/components/salas/unirse-con-codigo";
import { BotonLink } from "@/components/ui/boton";
import { obtenerAmistades } from "@/lib/amigos/consultas";
import { obtenerMisSalasEnCurso } from "@/lib/salas/consultas";
import { SIN_JUEGO } from "@/lib/salas/tipos";

export const metadata: Metadata = { title: "Jugar" };

const TARJETA = "border-borde bg-superficie space-y-3 rounded-2xl border p-4";

export default function JugarPage() {
  return (
    <>
      <EncabezadoPagina titulo="Jugar" />
      <div className="space-y-4">
        <section className={TARJETA} aria-labelledby="titulo-nueva">
          <h2 id="titulo-nueva" className="font-semibold">
            Nueva partida
          </h2>
          <p className="text-texto-suave text-sm">
            Elegí un juego, invitá a la mesa con un QR y cada uno anota sus puntos desde su celular.
            ¿No saben a qué jugar? Creá la sala sin juego y elijan entre los catálogos de todos.
          </p>
          <div className="flex flex-wrap gap-3">
            <BotonLink href="/jugar/nueva">
              <Plus aria-hidden className="size-4" /> Crear una sala
            </BotonLink>
            <BotonCrearSala juegoId={null} variante="secundario">
              Elegimos en la mesa
            </BotonCrearSala>
          </div>
        </section>

        <Suspense>
          <SalasEnCurso />
        </Suspense>

        <section className={TARJETA} aria-labelledby="titulo-unirse">
          <h2 id="titulo-unirse" className="font-semibold">
            Unirse con un código
          </h2>
          <UnirseConCodigo />
        </section>

        <Link
          href="/jugar/historial"
          className="border-borde bg-superficie hover:border-primario flex min-h-16 items-center gap-3 rounded-2xl border p-4"
        >
          <History aria-hidden className="text-primario size-6 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">Historial</span>
            <span className="text-texto-suave block text-sm">
              Partidas terminadas, resultados, notas y fotos
            </span>
          </span>
          <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
        </Link>

        <Link
          href="/jugar/ranking"
          className="border-borde bg-superficie hover:border-primario flex min-h-16 items-center gap-3 rounded-2xl border p-4"
        >
          <Trophy aria-hidden className="text-primario size-6 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">Ranking</span>
            <span className="text-texto-suave block text-sm">
              Victorias entre amigos y cara a cara
            </span>
          </span>
          <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
        </Link>

        <Link
          href="/jugar/quien-lo-tiene"
          className="border-borde bg-superficie hover:border-primario flex min-h-16 items-center gap-3 rounded-2xl border p-4"
        >
          <PackageSearch aria-hidden className="text-primario size-6 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">¿Quién lo tiene?</span>
            <span className="text-texto-suave block text-sm">Los juegos de tus amigos</span>
          </span>
          <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
        </Link>

        <Link
          href="/jugar/amigos"
          className="border-borde bg-superficie hover:border-primario flex min-h-16 items-center gap-3 rounded-2xl border p-4"
        >
          <Users aria-hidden className="text-primario size-6 shrink-0" />
          <span className="flex-1">
            <span className="block font-semibold">Amigos</span>
            <span className="text-texto-suave block text-sm">
              Tu código, solicitudes y lista de amigos
            </span>
          </span>
          <Suspense>
            <SolicitudesPendientes />
          </Suspense>
          <ChevronRight aria-hidden className="text-texto-suave size-5 shrink-0" />
        </Link>
      </div>
    </>
  );
}

async function SalasEnCurso() {
  const salas = await obtenerMisSalasEnCurso();
  if (salas.length === 0) return null;
  return (
    <section className={TARJETA} aria-labelledby="titulo-en-curso">
      <h2 id="titulo-en-curso" className="font-semibold">
        Partidas en curso
      </h2>
      <ul className="space-y-2">
        {salas.map((s) => (
          <li key={s.codigo}>
            <Link
              href={`/sala/${s.codigo}`}
              className="border-borde hover:border-primario flex min-h-14 items-center gap-3 rounded-xl border p-3"
            >
              <span className="relative flex size-2.5 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-green-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.juego_nombre ?? SIN_JUEGO}</span>
                <span className="text-texto-suave block text-sm">
                  {s.jugadores === 1 ? "1 jugador" : `${s.jugadores} jugadores`}
                  {s.soyAnfitrion ? " · sos anfitrión" : ""} · {s.codigo}
                </span>
              </span>
              <ChevronRight aria-hidden className="text-texto-suave size-5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SolicitudesPendientes() {
  const { recibidas } = await obtenerAmistades();
  if (recibidas.length === 0) return null;
  return (
    <span className="bg-primario text-sobre-primario rounded-full px-2 py-0.5 text-xs font-bold">
      {recibidas.length}
      <span className="sr-only">
        {" "}
        {recibidas.length === 1 ? "solicitud nueva" : "solicitudes nuevas"}
      </span>
    </span>
  );
}
