import type { ComponentProps } from "react";

/** Botón tipo "chip" que se activa y desactiva (aria-pressed). */
export function Chip({
  activo,
  className = "",
  ...props
}: ComponentProps<"button"> & { activo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={`min-h-10 rounded-full border-[1.5px] px-4 text-sm font-bold ${
        activo
          ? "bg-texto border-texto text-fondo"
          : "border-borde bg-superficie text-texto-suave hover:text-texto"
      } ${className}`}
      {...props}
    />
  );
}
