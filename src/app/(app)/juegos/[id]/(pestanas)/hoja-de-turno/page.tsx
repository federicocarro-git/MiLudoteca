import type { Metadata } from "next";
import { Suspense } from "react";
import { HerramientasHoja } from "@/components/juegos/herramientas-hoja";
import { EsqueletoResumen, SeccionResumen } from "@/components/juegos/seccion-resumen";

export const metadata: Metadata = { title: "Hoja de turno" };

export default function HojaDeTurnoPage({
  params,
  searchParams,
}: PageProps<"/juegos/[id]/hoja-de-turno">) {
  return (
    <Suspense fallback={<EsqueletoResumen />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <SeccionResumen
          juegoId={id}
          seccion="hoja_de_turno"
          herramientas={<HerramientasHoja />}
          guardado={sp.guardado === "1"}
        />
      ))}
    </Suspense>
  );
}
