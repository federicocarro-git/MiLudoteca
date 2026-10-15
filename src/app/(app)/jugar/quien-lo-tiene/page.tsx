import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { QuienLoTiene } from "@/components/mesa/quien-lo-tiene";
import { obtenerAmistades } from "@/lib/amigos/consultas";
import { obtenerJuegosDeAmigos } from "@/lib/mesa/consultas";

export const metadata: Metadata = { title: "¿Quién lo tiene?" };

export default function QuienLoTienePage() {
  return (
    <>
      <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>
      <EncabezadoPagina titulo="¿Quién lo tiene?" />
      <p className="text-texto-suave mb-4 text-sm">
        Los juegos de tus amigos, para saber quién lo trae a la juntada.
      </p>
      <Suspense fallback={<div className="bg-borde h-40 animate-pulse rounded-2xl" />}>
        <Juegos />
      </Suspense>
    </>
  );
}

async function Juegos() {
  const [juegos, { amigos }] = await Promise.all([obtenerJuegosDeAmigos(), obtenerAmistades()]);
  if (amigos.length === 0) {
    return (
      <p className="text-sm">
        Todavía no tenés amigos.{" "}
        <Link href="/jugar/amigos" className="text-primario font-semibold">
          Agregá a alguien
        </Link>{" "}
        con su código.
      </p>
    );
  }
  if (juegos.length === 0) {
    return (
      <p className="text-texto-suave text-sm">
        Tus amigos todavía no tienen juegos en su catálogo (o prefieren no mostrarlos).
      </p>
    );
  }
  // Solo los amigos que tienen algún juego visible.
  const conJuegos = amigos.filter((a) => juegos.some((j) => j.duenos.some((d) => d.id === a.id)));
  return <QuienLoTiene juegos={juegos} amigos={conJuegos} />;
}
