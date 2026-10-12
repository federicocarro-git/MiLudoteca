import { Dices, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogoInteractivo } from "@/components/catalogo/catalogo-interactivo";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { BotonLink } from "@/components/ui/boton";
import { obtenerMiCatalogo } from "@/lib/catalogo/consultas";

export const metadata: Metadata = { title: "Catálogo" };

export default function CatalogoPage() {
  return (
    <>
      <EncabezadoPagina titulo="Mi catálogo">
        <BotonLink
          href="/juegos/nuevo"
          variante="secundario"
          aria-label="Agregar juego"
          className="px-3"
        >
          <Plus aria-hidden className="size-5" />
          <span className="hidden sm:inline">Agregar</span>
        </BotonLink>
      </EncabezadoPagina>
      <Suspense fallback={<EsqueletoCatalogo />}>
        <Catalogo />
      </Suspense>
    </>
  );
}

async function Catalogo() {
  const juegos = await obtenerMiCatalogo();
  if (juegos.length === 0) return <CatalogoVacio />;
  return <CatalogoInteractivo juegos={juegos} />;
}

function CatalogoVacio() {
  return (
    <section className="border-borde bg-superficie flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <Dices aria-hidden className="text-primario size-10" />
      <h2 className="text-lg font-semibold">Todavía no agregaste juegos</h2>
      <p className="text-texto-suave max-w-xs text-sm">Cargá tu primer juego y armá tu ludoteca.</p>
      <BotonLink href="/juegos/nuevo">Agregá un juego</BotonLink>
    </section>
  );
}

function EsqueletoCatalogo() {
  return (
    <div aria-busy className="space-y-4">
      <div className="bg-borde h-11 animate-pulse rounded-xl" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="border-borde overflow-hidden rounded-2xl border">
            <div className="bg-borde aspect-square animate-pulse" />
            <div className="space-y-2 p-3">
              <div className="bg-borde h-4 w-3/4 animate-pulse rounded" />
              <div className="bg-borde h-3 w-1/2 animate-pulse rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
