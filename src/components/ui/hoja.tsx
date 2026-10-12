"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Hoja modal: en el celular sube desde abajo; en pantallas grandes es un
 * diálogo centrado. Usa <dialog> (foco, Escape y accesibilidad nativos).
 */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) dialogo.showModal();
    if (!abierta && dialogo.open) dialogo.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      onClose={onCerrar}
      // Tocar el fondo (el propio <dialog>, fuera del contenido) cierra.
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
      className="bg-superficie text-texto m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-3xl p-0 backdrop:bg-black/50 md:m-auto md:max-w-lg md:rounded-3xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="border-borde flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-texto-suave hover:text-texto -mr-2 flex size-11 items-center justify-center"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
