import type { Metadata } from "next";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/layout/encabezado-pagina";
import { EnlaceVolver } from "@/components/layout/enlace-volver";
import { RankingInteractivo } from "@/components/partidas/ranking-interactivo";
import { obtenerAmistades, obtenerMiPerfil } from "@/lib/amigos/consultas";
import { obtenerHistorial } from "@/lib/partidas/consultas";

export const metadata: Metadata = { title: "Ranking" };

export default function RankingPage({ searchParams }: PageProps<"/jugar/ranking">) {
  return (
    <>
      <EnlaceVolver href="/jugar">Jugar</EnlaceVolver>
      <EncabezadoPagina titulo="Ranking" />
      <Suspense fallback={<div className="bg-borde h-60 animate-pulse rounded-2xl" />}>
        {searchParams.then((sp) => (
          <Ranking juego={typeof sp.juego === "string" ? sp.juego : null} />
        ))}
      </Suspense>
    </>
  );
}

async function Ranking({ juego }: { juego: string | null }) {
  const [perfil, { amigos }, partidas] = await Promise.all([
    obtenerMiPerfil(),
    obtenerAmistades(),
    obtenerHistorial(),
  ]);
  if (!perfil) return null;
  return (
    <RankingInteractivo
      partidas={partidas}
      yo={{ id: perfil.id, nombre: perfil.nombre }}
      amigos={amigos.map(({ id, nombre }) => ({ id, nombre }))}
      juegoInicial={juego}
    />
  );
}
