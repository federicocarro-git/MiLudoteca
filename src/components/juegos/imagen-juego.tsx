import { Dices } from "lucide-react";
import Image from "next/image";

/**
 * Imagen de un juego, o un placeholder si no tiene. Las URLs http (Storage del
 * Supabase local) no pasan por el optimizador de Next, que bloquea IPs locales.
 */
export function ImagenJuego({
  url,
  nombre,
  sizes,
  className = "",
  priority = false,
}: {
  url: string | null;
  nombre: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`bg-fondo relative overflow-hidden ${className}`}>
      {url ? (
        <Image
          src={url}
          alt={`Caja de ${nombre}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={url.startsWith("http://")}
          className="object-cover"
        />
      ) : (
        <div className="text-texto-suave/50 flex size-full items-center justify-center">
          <Dices aria-hidden className="size-1/3 max-h-16 max-w-16" />
        </div>
      )}
    </div>
  );
}
