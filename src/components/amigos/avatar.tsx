import { colorDeNombre } from "@/lib/formato";

/**
 * Inicial del nombre en un posavasos de color (no hay fotos de perfil). El
 * color sale del nombre: la misma persona tiene siempre el mismo.
 */
export function Avatar({ nombre, className = "" }: { nombre: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: colorDeNombre(nombre) }}
      className={`font-display inline-flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-white/55 text-lg font-bold text-[#fffaf1] uppercase outline-2 -outline-offset-8 outline-[#3a2a1f]/25 outline-dashed ${className}`}
    >
      {nombre.trim().charAt(0) || "?"}
    </span>
  );
}
