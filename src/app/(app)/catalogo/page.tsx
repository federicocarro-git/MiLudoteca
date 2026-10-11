import { Dices } from "lucide-react";
import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { BotonLink } from "@/components/ui/boton";

export const metadata: Metadata = { title: "Catálogo" };

// Hito 5: listado con filtros y "¿A qué jugamos?".
export default function CatalogoPage() {
  return (
    <>
      <EncabezadoPagina titulo="Mi catálogo" />
      <section className="border-borde bg-superficie flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
        <Dices aria-hidden className="text-primario size-10" />
        <h2 className="text-lg font-semibold">Todavía no agregaste juegos</h2>
        <p className="text-texto-suave max-w-xs text-sm">
          Cargá tu primer juego y armá tu ludoteca.
        </p>
        <BotonLink href="/juegos/nuevo">Agregá un juego</BotonLink>
      </section>
    </>
  );
}
