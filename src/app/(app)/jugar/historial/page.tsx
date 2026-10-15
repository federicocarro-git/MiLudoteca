import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { HistorialFiltrado } from "@/components/partidas/historial-filtrado";
import { getUsuarioActual } from "@/lib/auth";
import { obtenerHistorial } from "@/lib/partidas/consultas";

export const metadata: Metadata = { title: "Historial" };

export default function HistorialPage({ searchParams }: PageProps<"/jugar/historial">) {
  return (
    <>
      <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>
      <EncabezadoPagina titulo="Historial" />
      <Suspense fallback={<div className="bg-borde h-40 animate-pulse rounded-2xl" />}>
        {searchParams.then((sp) => (
          <Historial
            juego={typeof sp.juego === "string" ? sp.juego : null}
            con={typeof sp.con === "string" ? sp.con : null}
          />
        ))}
      </Suspense>
    </>
  );
}

async function Historial(filtros: { juego: string | null; con: string | null }) {
  const [usuario, partidas] = await Promise.all([getUsuarioActual(), obtenerHistorial()]);
  if (!usuario) return null;
  if (partidas.length === 0) {
    return (
      <p className="text-sm">
        Todavía no terminaste ninguna partida.{" "}
        <Link href="/jugar/nueva" className="text-primario font-semibold">
          Creá una sala
        </Link>{" "}
        y, al final, el anfitrión toca &quot;Terminar partida&quot;.
      </p>
    );
  }
  return <HistorialFiltrado partidas={partidas} yo={usuario.id} filtrosIniciales={filtros} />;
}
