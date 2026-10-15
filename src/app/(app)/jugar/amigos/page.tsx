import type { Metadata } from "next";
import { Suspense } from "react";
import { AgregarAmigo } from "@/components/amigos/agregar-amigo";
import { CodigoAmigo } from "@/components/amigos/codigo-amigo";
import { ListaAmigos } from "@/components/amigos/lista-amigos";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { obtenerAmistades, obtenerMiPerfil } from "@/lib/amigos/consultas";

export const metadata: Metadata = { title: "Amigos" };

const TARJETA = "border-borde bg-superficie space-y-3 rounded-2xl border p-4";

export default function AmigosPage({ searchParams }: PageProps<"/jugar/amigos">) {
  return (
    <>
      <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>
      <EncabezadoPagina titulo="Amigos" />
      <div className="space-y-4">
        <section className={TARJETA} aria-labelledby="titulo-codigo">
          <h2 id="titulo-codigo" className="font-semibold">
            Tu código de amigo
          </h2>
          <p className="text-texto-suave text-sm">
            Pasáselo a quien quieras agregar: con este código te encuentra.
          </p>
          <Suspense fallback={<div className="bg-borde h-9 w-48 animate-pulse rounded" />}>
            <TuCodigo />
          </Suspense>
        </section>

        <section className={TARJETA} aria-labelledby="titulo-agregar">
          <h2 id="titulo-agregar" className="font-semibold">
            Agregar un amigo
          </h2>
          <Suspense fallback={<AgregarAmigo />}>
            {searchParams.then((sp) => (
              <AgregarAmigo codigoInicial={typeof sp.codigo === "string" ? sp.codigo : ""} />
            ))}
          </Suspense>
        </section>

        <Suspense fallback={<div className="bg-borde h-32 animate-pulse rounded-2xl" />}>
          <Lista />
        </Suspense>
      </div>
    </>
  );
}

async function TuCodigo() {
  const perfil = await obtenerMiPerfil();
  if (!perfil) return <p className="text-sm">No encontramos tu perfil. Volvé a ingresar.</p>;
  return <CodigoAmigo codigo={perfil.codigo_amigo} />;
}

async function Lista() {
  return <ListaAmigos amistades={await obtenerAmistades()} />;
}
