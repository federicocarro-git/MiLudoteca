import { CircleCheck, FileText, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { EnlaceBgg } from "./enlace-bgg";
import { BotonLink } from "@/components/ui/boton";
import { obtenerJuego, obtenerResumen } from "@/lib/juegos/consultas";

type Seccion = "como_se_juega" | "hoja_de_turno";

// Las dos secciones son opcionales y se completan a mano.
const TEXTOS: Record<Seccion, { vacio: string; ayuda: string; ancla: string }> = {
  como_se_juega: {
    vacio: "Todavía no hay un resumen de cómo se juega",
    ayuda: "Un resumen de las reglas para explicarlo rápido: objetivo, preparación, turno y final.",
    ancla: "como-se-juega",
  },
  hoja_de_turno: {
    vacio: "Todavía no hay hoja de turno",
    ayuda: "Una guía corta para tener en la mesa: qué se hace en cada fase del turno.",
    ancla: "hoja-de-turno",
  },
};

const AYUDA_BGG =
  "En BoardGameGeek vas a encontrar el reglamento y las ayudas que subió la comunidad. También podés escribir tu propio resumen.";

/** Contenido de "Cómo se juega" u "Hoja de turno" (markdown del resumen propio). */
export async function SeccionResumen({
  juegoId,
  seccion,
  herramientas,
  guardado = false,
}: {
  juegoId: string;
  seccion: Seccion;
  herramientas?: ReactNode;
  guardado?: boolean;
}) {
  const [juego, resumen] = await Promise.all([obtenerJuego(juegoId), obtenerResumen(juegoId)]);
  if (!juego) notFound();
  const texto = resumen?.[seccion]?.trim();
  const editar = `/juegos/${juegoId}/resumen/editar?seccion=${TEXTOS[seccion].ancla}`;

  if (!texto) {
    // Con bgg_id (de BGG o manual con referencia): primero el link a BGG y,
    // como opción secundaria, escribirlo. Sin bgg_id: solo escribirlo.
    const bggId = juego.juego.bgg_id;
    return (
      <section className="border-borde bg-superficie flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
        <FileText aria-hidden className="text-primario size-10" />
        <h2 className="font-semibold">{TEXTOS[seccion].vacio}</h2>
        <p className="text-texto-suave max-w-xs text-sm">
          {bggId ? AYUDA_BGG : TEXTOS[seccion].ayuda}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {bggId && <EnlaceBgg bggId={bggId} variante="boton" />}
          <BotonLink href={editar} variante={bggId ? "secundario" : "primario"}>
            <Pencil aria-hidden className="size-4" /> Escribir
          </BotonLink>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {guardado && (
        <p
          role="status"
          className="bg-primario/10 flex items-center gap-2 rounded-2xl p-3 text-sm font-medium print:hidden"
        >
          <CircleCheck aria-hidden className="text-primario size-5" />
          Guardaste el resumen.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {herramientas ?? <span />}
        <BotonLink href={editar} variante="secundario">
          <Pencil aria-hidden className="size-4" /> Editar
        </BotonLink>
      </div>
      <Markdown texto={texto} variante={seccion === "hoja_de_turno" ? "hoja" : "normal"} />
    </div>
  );
}

export function EsqueletoResumen() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="bg-borde h-6 w-1/2 animate-pulse rounded" />
      <div className="bg-borde h-4 w-full animate-pulse rounded" />
      <div className="bg-borde h-4 w-5/6 animate-pulse rounded" />
      <div className="bg-borde h-4 w-4/6 animate-pulse rounded" />
    </div>
  );
}
