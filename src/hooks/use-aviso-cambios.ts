"use client";

import { useEffect } from "react";

const MENSAJE = "Tenés cambios sin guardar. ¿Salir igual?";

/**
 * Avisa antes de perder cambios: al cerrar o recargar la pestaña
 * (beforeunload) y al tocar cualquier link de la app (los <Link> de Next
 * respetan defaultPrevented). El botón "atrás" del navegador no se puede
 * frenar; para eso está el borrador local.
 */
export function useAvisoCambios(hayCambios: boolean) {
  useEffect(() => {
    if (!hayCambios) return;

    const antesDeSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    const alHacerClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.origin !== window.location.origin) return;
      if (!window.confirm(MENSAJE)) e.preventDefault();
    };

    window.addEventListener("beforeunload", antesDeSalir);
    // Fase de captura: corre antes que el onClick de los <Link>.
    document.addEventListener("click", alHacerClick, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSalir);
      document.removeEventListener("click", alHacerClick, true);
    };
  }, [hayCambios]);
}
