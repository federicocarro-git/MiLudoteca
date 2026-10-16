import Link from "next/link";
import type { ComponentProps } from "react";

type Variante = "primario" | "secundario" | "acento";

// Redondeados y con "relieve" (sombra dura abajo); al apretarlos se hunden.
const ESTILOS: Record<Variante, string> = {
  primario: "bg-primario text-sobre-primario hover:bg-primario-hover relieve-primario",
  secundario: "border-[1.5px] border-borde bg-superficie text-texto hover:bg-fondo relieve",
  acento: "bg-acento text-sobre-acento hover:brightness-105 relieve-acento",
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition active:translate-y-0.5 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:pointer-events-none disabled:opacity-50";

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={`${BASE} ${ESTILOS[variante]} ${className}`} {...props} />;
}

export function BotonLink({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={`${BASE} ${ESTILOS[variante]} ${className}`} {...props} />;
}
