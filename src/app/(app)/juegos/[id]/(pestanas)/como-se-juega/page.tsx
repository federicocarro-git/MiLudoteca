import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoResumen, SeccionResumen } from "@/components/juegos/seccion-resumen";

export const metadata: Metadata = { title: "Cómo se juega" };

export default function ComoSeJuegaPage({
  params,
  searchParams,
}: PageProps<"/juegos/[id]/como-se-juega">) {
  return (
    <Suspense fallback={<EsqueletoResumen />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <SeccionResumen juegoId={id} seccion="como_se_juega" guardado={sp.guardado === "1"} />
      ))}
    </Suspense>
  );
}
