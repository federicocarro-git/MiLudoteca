import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PestanasJuego, PestanasVista } from "@/components/juegos/pestanas-juego";
import { obtenerJuego } from "@/lib/juegos/consultas";

// Encabezado y pestañas comunes a Ficha / Cómo se juega / Hoja de turno.
// No se hace await de params acá (bloquearía todo el segmento): cada parte
// que lo necesita lo resuelve dentro de su <Suspense>.
export default function PestanasLayout({ children, params }: LayoutProps<"/juegos/[id]">) {
  return (
    <div className="space-y-3">
      <Link
        href="/catalogo"
        className="text-texto-suave hover:text-texto -ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium print:hidden"
      >
        <ChevronLeft aria-hidden className="size-5" />
        Catálogo
      </Link>
      <Suspense fallback={<div className="bg-borde h-8 w-2/3 animate-pulse rounded" />}>
        {params.then(({ id }) => (
          <Encabezado id={id} />
        ))}
      </Suspense>
      <Suspense fallback={<div className="h-14" />}>
        {params.then(({ id }) => (
          <Suspense fallback={<PestanasVista id={id} pathname={null} />}>
            <PestanasJuego id={id} />
          </Suspense>
        ))}
      </Suspense>
      <div className="pt-2">{children}</div>
    </div>
  );
}

async function Encabezado({ id }: { id: string }) {
  const resultado = await obtenerJuego(id);
  if (!resultado) notFound();
  const { juego } = resultado;
  return (
    <header>
      <h1 className="text-2xl leading-tight font-bold tracking-tight print:text-3xl">
        {juego.nombre}
        {juego.anio && (
          <span className="text-texto-suave ml-2 text-lg font-normal">({juego.anio})</span>
        )}
      </h1>
    </header>
  );
}
