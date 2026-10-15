"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Boton } from "@/components/ui/boton";

const sinSuscripcion = () => () => {};

/** QR, código y link de la sala, para que se sumen los demás. */
export function InvitarASala({
  codigo,
  url,
  qrSvg,
}: {
  codigo: string;
  url: string;
  qrSvg: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const puedeCompartir = useSyncExternalStore(
    sinSuscripcion,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el código igual se ve en pantalla.
    }
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-texto-suave text-sm">
        Que escaneen el QR con la cámara del celular. Pueden entrar con su cuenta o como invitados,
        sin registrarse.
      </p>
      <div
        role="img"
        aria-label={`QR para entrar a la sala ${codigo}`}
        className="mx-auto w-full max-w-64 rounded-2xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
        // SVG generado por nosotros en el servidor (qrcode), no viene del usuario.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div>
        <p className="text-texto-suave text-sm">O con el código</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="codigo-sala">
          {codigo}
        </p>
        <p className="text-texto-suave text-xs">en Jugar → Unirse con un código</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Boton variante="secundario" onClick={copiar}>
          {copiado ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copiado ? "Link copiado" : "Copiar link"}
        </Boton>
        {puedeCompartir && (
          <Boton
            variante="secundario"
            onClick={() =>
              navigator
                .share({ title: "MiLudoteca", text: `Sumate a la partida. Código: ${codigo}`, url })
                .catch(() => {})
            }
          >
            <Share2 aria-hidden className="size-4" /> Compartir
          </Boton>
        )}
      </div>
    </div>
  );
}
