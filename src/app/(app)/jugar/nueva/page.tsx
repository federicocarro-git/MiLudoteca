import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { ElegirJuego } from "@/components/salas/elegir-juego";
import { obtenerMiCatalogo } from "@/lib/catalogo/consultas";

export const metadata: Metadata = { title: "Nueva sala" };

export default function NuevaSalaPage() {
  return (
    <>
      <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>
      <EncabezadoPagina titulo="¿A qué juegan?" />
      <p className="text-texto-suave mb-4 text-sm">
        Elegí un juego de tu catálogo. Se crea la sala y después invitás a los demás con el QR o el
        código.
      </p>
      <Suspense fallback={<div className="bg-borde h-40 animate-pulse rounded-2xl" />}>
        <Juegos />
      </Suspense>
    </>
  );
}

async function Juegos() {
  const juegos = await obtenerMiCatalogo();
  if (juegos.length === 0) {
    return (
      <p className="text-sm">
        Tu catálogo está vacío.{" "}
        <Link href="/juegos/nuevo" className="text-primario font-semibold">
          Agregá un juego
        </Link>{" "}
        para crear una sala.
      </p>
    );
  }
  return (
    <ElegirJuego
      juegos={juegos.map(({ id, nombre, imagen_url, jugadores_min, jugadores_max }) => ({
        id,
        nombre,
        imagen_url,
        jugadores_min,
        jugadores_max,
      }))}
    />
  );
}
