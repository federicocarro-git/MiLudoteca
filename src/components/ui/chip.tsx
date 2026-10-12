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
      className={`min-h-10 rounded-full border px-3.5 text-sm ${
        activo
          ? "bg-primario border-primario text-sobre-primario"
          : "border-borde text-texto-suave hover:text-texto"
      } ${className}`}
      {...props}
    />
  );
}
