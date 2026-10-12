"use client";

import { Printer, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Botones de la hoja de turno: imprimir y mantener la pantalla encendida
 * mientras se juega (Screen Wake Lock, si el navegador lo soporta).
 */
export function HerramientasHoja() {
  const [soportaWakeLock, setSoportaWakeLock] = useState(false);
  const [encendida, setEncendida] = useState(false);
  const bloqueo = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // Recién en el cliente se sabe si hay soporte (evita diferencias de hidratación).
    queueMicrotask(() => setSoportaWakeLock("wakeLock" in navigator));
    return () => {
      void bloqueo.current?.release();
    };
  }, []);

  // El navegador suelta el bloqueo al cambiar de pestaña: se pide de nuevo al volver.
  useEffect(() => {
    if (!encendida) return;
    const alVolver = async () => {
      if (document.visibilityState === "visible" && !bloqueo.current) {
        bloqueo.current = await navigator.wakeLock.request("screen").catch(() => null);
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [encendida]);

  async function alternar() {
    if (encendida) {
      await bloqueo.current?.release();
      bloqueo.current = null;
      setEncendida(false);
      return;
    }
    try {
      bloqueo.current = await navigator.wakeLock.request("screen");
      bloqueo.current.addEventListener("release", () => {
        bloqueo.current = null;
      });
      setEncendida(true);
    } catch {
      setEncendida(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="border-borde bg-superficie hover:bg-fondo inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold"
      >
        <Printer aria-hidden className="size-4" /> Imprimir
      </button>
      {soportaWakeLock && (
        <button
          type="button"
          aria-pressed={encendida}
          onClick={alternar}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
            encendida
              ? "bg-primario border-primario text-sobre-primario"
              : "border-borde bg-superficie hover:bg-fondo"
          }`}
        >
          <Sun aria-hidden className="size-4" />
          {encendida ? "Pantalla siempre encendida" : "Mantener pantalla encendida"}
        </button>
      )}
    </div>
  );
}
