import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { urlJuegoBgg } from "@/lib/game-data/bgg/enlaces";

const ESTILOS = {
  // Mismo aspecto que BotonLink (primario), pero es un <a> externo.
  boton:
    "bg-primario text-sobre-primario hover:bg-primario-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold",
  texto:
    "text-primario inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline",
};

/** Link a la página del juego en BoardGameGeek, en una pestaña nueva. */
export function EnlaceBgg({
  bggId,
  variante = "texto",
  children = "Ver en BoardGameGeek",
  className = "",
}: {
  bggId: number;
  variante?: keyof typeof ESTILOS;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={urlJuegoBgg(bggId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${ESTILOS[variante]} ${className}`}
    >
      {children}
      <ExternalLink aria-hidden className="size-4" />
      <span className="sr-only">(se abre en otra pestaña)</span>
    </a>
  );
}
