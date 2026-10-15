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
import { obtenerSala, vistaPreviaSala, type VistaPrevia } from "@/lib/salas/consultas";
import { urlDelSitio } from "@/lib/sitio";
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
  sesion,
}: Awaited<NonNullable<ReturnType<typeof obtenerSala>>> & { sesion: SesionActual }) {
  const url = `${urlDelSitio()}/sala/${sala.codigo}`;
  const soyAnfitrion = sala.anfitrion_id === sesion.id;
  const [qrSvg, amistades] = await Promise.all([
    svgQrSala(url),
    soyAnfitrion ? obtenerAmistades() : null,
  ]);

  return (
    <>
      {!sesion.anonimo && <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>}
      <header className="mb-4 flex items-center gap-3">
        <ImagenJuego
          url={sala.juego_imagen_url}
          nombre={sala.juego_nombre}
          sizes="64px"
          className="size-16 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{sala.juego_nombre}</h1>
          <p className="text-texto-suave text-sm">
            Sala <span className="font-mono font-semibold tracking-widest">{sala.codigo}</span>
          </p>
        </div>
      </header>
      <SalaEnVivo
        sala={sala}
        jugadores={jugadores}
        yo={sesion.id}
        url={url}
        qrSvg={qrSvg}
        amigosDisponibles={amistades?.amigos.map(({ id, nombre }) => ({ id, nombre })) ?? []}
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
      <section className="border-borde bg-superficie space-y-4 rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <ImagenJuego
            url={previa.juego_imagen_url}
            nombre={previa.juego_nombre}
            sizes="64px"
            className="size-16 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-texto-suave text-sm">{previa.anfitrion} te invita a jugar</p>
            <h1 className="truncate text-xl font-bold">{previa.juego_nombre}</h1>
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
    <section className="border-borde bg-superficie mx-auto max-w-md space-y-3 rounded-2xl border p-6 text-center">
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
