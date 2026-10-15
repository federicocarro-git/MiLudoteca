"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Boton } from "@/components/ui/boton";

const sinSuscripcion = () => () => {};

/** Tu código de amigo, con botones para copiarlo o compartirlo. */
export function CodigoAmigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  // En el servidor no hay navigator: el botón aparece después de hidratar.
  const puedeCompartir = useSyncExternalStore(
    sinSuscripcion,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el código igual se ve en pantalla.
    }
  }

  async function compartir() {
    const url = `${window.location.origin}/jugar/amigos?codigo=${codigo}`;
    try {
      await navigator.share({
        title: "MiLudoteca",
        text: `Agregame como amigo en MiLudoteca. Mi código es ${codigo}.`,
        url,
      });
    } catch {
      // La persona cerró el menú de compartir.
    }
  }

  return (
    <div className="space-y-3">
      <p
        className="font-mono text-3xl font-bold tracking-[0.3em]"
        aria-label={`Tu código: ${codigo.split("").join(" ")}`}
      >
        {codigo}
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={copiar}>
          {copiado ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </Boton>
        {puedeCompartir && (
          <Boton variante="secundario" onClick={compartir}>
            <Share2 aria-hidden className="size-4" /> Compartir
          </Boton>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {copiado ? "Código copiado" : ""}
      </p>
    </div>
  );
}
