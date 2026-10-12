import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditorResumen } from "@/components/resumenes/editor-resumen";
import { obtenerJuego, obtenerResumen } from "@/lib/juegos/consultas";
import { seccionDesdeUrl } from "@/lib/validations/resumen";
import { guardarResumen } from "./actions";

export const metadata: Metadata = { title: "Editar resumen" };

export default function EditarResumenPage({
  params,
  searchParams,
}: PageProps<"/juegos/[id]/resumen/editar">) {
  return (
    <Suspense fallback={<div className="bg-borde h-[70dvh] animate-pulse rounded-2xl" />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <Editar id={id} seccion={seccionDesdeUrl(sp.seccion)} />
      ))}
    </Suspense>
  );
}

async function Editar({
  id,
  seccion,
}: {
  id: string;
  seccion: ReturnType<typeof seccionDesdeUrl>;
}) {
  const [juego, resumen] = await Promise.all([obtenerJuego(id), obtenerResumen(id)]);
  if (!juego) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/juegos/${id}/${seccion}`}
        className="text-texto-suave hover:text-texto -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
      >
        <ChevronLeft aria-hidden className="size-5" />
        {juego.juego.nombre}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Resumen</h1>
      <EditorResumen
        juegoId={id}
        inicial={{
          como_se_juega: resumen?.como_se_juega ?? "",
          hoja_de_turno: resumen?.hoja_de_turno ?? "",
        }}
        seccionInicial={seccion}
        accion={guardarResumen.bind(null, id)}
      />
    </div>
  );
}
