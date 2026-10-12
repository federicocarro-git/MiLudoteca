import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { FormularioJuego } from "@/components/juegos/formulario-juego";
import { elegirProvider } from "@/lib/game-data";

export const metadata: Metadata = { title: "Agregar juego" };

export default function NuevoJuegoPage() {
  // Sin provider (producción sin token de BGG) se oculta la búsqueda.
  const origen = elegirProvider(process.env);
  return (
    <>
      <EncabezadoPagina titulo="Agregar juego" />
      <FormularioJuego origen={origen} />
    </>
  );
}
