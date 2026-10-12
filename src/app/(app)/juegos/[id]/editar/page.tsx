import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormularioJuego } from "@/components/juegos/formulario-juego";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { obtenerJuego } from "@/lib/juegos/consultas";
import { valoresDesde } from "@/lib/juegos/valores-formulario";
import { actualizarJuego } from "../actions";

export const metadata: Metadata = { title: "Editar juego" };

export default function EditarJuegoPage({ params }: PageProps<"/juegos/[id]/editar">) {
  return (
    <Suspense fallback={<div className="bg-borde h-96 animate-pulse rounded-2xl" />}>
      {params.then(({ id }) => (
        <Editar id={id} />
      ))}
    </Suspense>
  );
}

async function Editar({ id }: { id: string }) {
  const resultado = await obtenerJuego(id);
  // Solo los juegos manuales propios se editan (los de BGG son compartidos).
  if (!resultado?.editable) notFound();
  const { juego, catalogo } = resultado;

  return (
    <>
      <Link
        href={`/juegos/${id}`}
        className="text-texto-suave hover:text-texto -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
      >
        <ChevronLeft aria-hidden className="size-5" />
        {juego.nombre}
      </Link>
      <EncabezadoPagina titulo="Editar juego" />
      <FormularioJuego
        origen={null}
        inicial={valoresDesde(juego, undefined, catalogo)}
        bggIdInicial={juego.bgg_id}
        accion={actualizarJuego.bind(null, id)}
        textoBoton="Guardar cambios"
      />
    </>
  );
}
