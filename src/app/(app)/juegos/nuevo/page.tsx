import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";

export const metadata: Metadata = { title: "Agregar juego" };

// Hito 4: formulario de carga manual + panel de búsqueda.
export default function NuevoJuegoPage() {
  return (
    <>
      <EncabezadoPagina titulo="Agregar juego" />
      <p className="text-texto-suave">El formulario de carga llega en el hito 4.</p>
    </>
  );
}
