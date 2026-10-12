import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoResumen, SeccionResumen } from "@/components/juegos/seccion-resumen";

export const metadata: Metadata = { title: "Cómo se juega" };

export default function ComoSeJuegaPage({ params }: PageProps<"/juegos/[id]/como-se-juega">) {
  return (
    <Suspense fallback={<EsqueletoResumen />}>
      {params.then(({ id }) => (
        <SeccionResumen juegoId={id} seccion="como_se_juega" />
      ))}
    </Suspense>
  );
}
