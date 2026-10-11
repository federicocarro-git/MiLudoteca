import Link from "next/link";
import type { ComponentProps } from "react";

type Variante = "primario" | "secundario";

const ESTILOS: Record<Variante, string> = {
  primario: "bg-primario text-sobre-primario hover:bg-primario-hover",
  secundario: "border border-borde bg-superficie text-texto hover:bg-fondo",
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:opacity-50";

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
