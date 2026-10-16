import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { ImagenJuego } from "@/components/juegos/imagen-juego";
import { svgQrSala } from "@/components/salas/qr-sala";
import { SalaEnVivo } from "@/components/salas/sala-en-vivo";
import { EntrarComoInvitado, UnirmeConMiCuenta } from "@/components/salas/unirse-a-sala";
import { obtenerAmistades } from "@/lib/amigos/consultas";
import { getSesionActual, type SesionActual } from "@/lib/auth";
import { obtenerJuego } from "@/lib/juegos/consultas";
import {
  obtenerHojaGuardada,
  obtenerSala,
  vistaPreviaSala,
  type VistaPrevia,
} from "@/lib/salas/consultas";
import { urlDelSitio } from "@/lib/sitio";
import { SIN_JUEGO } from "@/lib/salas/tipos";
import { codigoSalaSchema } from "@/lib/validations/salas";

export const metadata: Metadata = { title: "Sala" };

export default function SalaPage({ params }: PageProps<"/sala/[codigo]">) {
  return (
    <Suspense fallback={<EsqueletoSala />}>
      {params.then(({ codigo }) => (
        <ContenidoSala codigo={codigo} />
      ))}
    </Suspense>
  );
}

async function ContenidoSala({ codigo: crudo }: { codigo: string }) {
  const parseo = codigoSalaSchema.safeParse(decodeURIComponent(crudo));
  if (!parseo.success) return <SalaNoEncontrada />;
  const codigo = parseo.data;
  if (codigo !== crudo) redirect(`/sala/${codigo}`);

  const sesion = await getSesionActual();
  if (sesion) {
    const datos = await obtenerSala(codigo);
    if (datos) return <SalaActiva {...datos} sesion={sesion} />;
  }
  const previa = await vistaPreviaSala(codigo);
  if (!previa) return <SalaNoEncontrada conCuenta={Boolean(sesion && !sesion.anonimo)} />;
  return <Unirse codigo={codigo} previa={previa} sesion={sesion} />;
}

async function SalaActiva({
  sala,
  jugadores,
  anotaciones,
  sesion,
}: Awaited<NonNullable<ReturnType<typeof obtenerSala>>> & { sesion: SesionActual }) {
  const url = `${urlDelSitio()}/sala/${sala.codigo}`;
  const soyAnfitrion = sala.anfitrion_id === sesion.id;
  const [qrSvg, amistades, juegoVisible, hojaGuardada] = await Promise.all([
    svgQrSala(url),
    soyAnfitrion ? obtenerAmistades() : null,
    // La hoja se guarda por juego: solo si el anfitrión lo puede ver.
    soyAnfitrion && sala.juego_id ? obtenerJuego(sala.juego_id) : null,
    soyAnfitrion && sala.juego_id ? obtenerHojaGuardada(sala.juego_id) : null,
  ]);

  return (
    <>
      {!sesion.anonimo && <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>}
      {/* La sala como una comanda de café: el juego arriba y el código abajo del corte. */}
      <header className="bg-superficie border-borde relieve relative mb-4 rounded-[1.25rem] border-[1.5px]">
        <div className="flex items-center gap-3 p-3.5 pb-4">
          <ImagenJuego
            url={sala.juego_imagen_url}
            nombre={sala.juego_nombre ?? SIN_JUEGO}
            sizes="64px"
            className="size-16 shrink-0 rounded-xl"
          />
          <h1 className="min-w-0 truncate text-[1.75rem] leading-tight font-bold">
            {sala.juego_nombre ?? SIN_JUEGO}
          </h1>
        </div>
        <div aria-hidden className="border-borde mx-4 border-t-2 border-dashed" />
        <p className="flex items-center justify-between px-3.5 py-3">
          <span className="text-texto-suave text-xs font-extrabold tracking-widest uppercase">
            Código
          </span>
          <span className="font-mono text-lg font-bold tracking-[0.3em]">{sala.codigo}</span>
        </p>
      </header>
      {/* key: si se pasa de una sala a otra, que no quede estado de la anterior. */}
      <SalaEnVivo
        key={sala.id}
        sala={sala}
        jugadores={jugadores}
        anotaciones={anotaciones}
        yo={sesion.id}
        url={url}
        qrSvg={qrSvg}
        amigosDisponibles={amistades?.amigos.map(({ id, nombre }) => ({ id, nombre })) ?? []}
        hojaGuardada={hojaGuardada}
        juegoParaHoja={juegoVisible ? sala.juego_id : null}
      />
      {sesion.anonimo && (
        <p className="text-texto-suave mt-6 text-center text-xs">
          Estás como invitado: esta partida no queda en un historial tuyo.{" "}
          <Link
            href={`/login?next=/sala/${sala.codigo}`}
            className="text-primario font-medium underline"
          >
            Ingresá con tu cuenta
          </Link>{" "}
          para guardar tus partidas.
        </p>
      )}
    </>
  );
}

function Unirse({
  codigo,
  previa,
  sesion,
}: {
  codigo: string;
  previa: VistaPrevia;
  sesion: SesionActual | null;
}) {
  const conCuenta = sesion !== null && !sesion.anonimo;
  return (
    <div className="mx-auto max-w-md space-y-4">
      {conCuenta && <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>}
      <section className="border-borde bg-superficie relieve space-y-4 rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <ImagenJuego
            url={previa.juego_imagen_url}
            nombre={previa.juego_nombre ?? SIN_JUEGO}
            sizes="64px"
            className="size-16 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-texto-suave text-sm">{previa.anfitrion} te invita a jugar</p>
            <h1 className="truncate text-xl font-bold">{previa.juego_nombre ?? SIN_JUEGO}</h1>
            <p className="text-texto-suave flex items-center gap-1 text-sm">
              <Users aria-hidden className="size-4" />
              {previa.jugadores === 1 ? "1 jugador" : `${previa.jugadores} jugadores`} · sala{" "}
              <span className="font-mono tracking-widest">{codigo}</span>
            </p>
          </div>
        </div>
        {conCuenta ? <UnirmeConMiCuenta codigo={codigo} /> : <EntrarComoInvitado codigo={codigo} />}
      </section>
      {!conCuenta && (
        <p className="text-texto-suave text-center text-sm">
          ¿Tenés cuenta en MiLudoteca?{" "}
          <Link href={`/login?next=/sala/${codigo}`} className="text-primario font-semibold">
            Ingresá
          </Link>{" "}
          para que la partida quede en tu historial.
        </p>
      )}
    </div>
  );
}

function SalaNoEncontrada({ conCuenta = false }: { conCuenta?: boolean }) {
  return (
    <section className="border-borde bg-superficie relieve mx-auto max-w-md space-y-3 rounded-2xl border p-6 text-center">
      <h1 className="text-xl font-bold">No encontramos esa sala</h1>
      <p className="text-texto-suave text-sm">
        Puede que el código esté mal escrito o que la partida ya haya terminado.
      </p>
      <Link
        href={conCuenta ? "/jugar" : "/login"}
        className="text-primario inline-flex min-h-11 items-center font-semibold"
      >
        {conCuenta ? "Ir a Jugar" : "Ir a MiLudoteca"}
      </Link>
    </section>
  );
}

function EsqueletoSala() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="bg-borde h-16 w-2/3 animate-pulse rounded-xl" />
      <div className="bg-borde h-20 animate-pulse rounded-2xl" />
      <div className="bg-borde h-20 animate-pulse rounded-2xl" />
    </div>
  );
}
