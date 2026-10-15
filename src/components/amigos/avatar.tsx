/** Círculo con la inicial del nombre (no hay fotos de perfil). */
export function Avatar({ nombre, className = "" }: { nombre: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`bg-primario/15 text-primario inline-flex size-10 shrink-0 items-center justify-center rounded-full font-semibold uppercase ${className}`}
    >
      {nombre.trim().charAt(0) || "?"}
    </span>
  );
}
