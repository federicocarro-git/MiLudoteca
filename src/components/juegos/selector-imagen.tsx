"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorImagen, prepararImagen } from "@/lib/imagenes";
import { createClient } from "@/lib/supabase/client";
import { ImagenJuego } from "./imagen-juego";

const BUCKET = "imagenes-juegos";

/**
 * Elige una foto (en el celular ofrece la cámara), la achica en el navegador y
 * la sube a Storage en la carpeta del usuario. Devuelve la URL pública.
 */
export function SelectorImagen({
  url,
  nombre,
  onCambio,
  error,
}: {
  url: string | null;
  nombre: string;
  onCambio: (url: string | null) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const { blob, extension } = await prepararImagen(archivo);
      const supabase = createClient();
      const { data: sesion } = await supabase.auth.getSession();
      const userId = sesion.session?.user.id;
      if (!userId) throw new ErrorImagen("Tu sesión venció. Volvé a ingresar.");
      const ruta = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: errorStorage } = await supabase.storage
        .from(BUCKET)
        .upload(ruta, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (errorStorage) throw errorStorage;
      onCambio(supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl);
    } catch (e) {
      console.error(e);
      setErrorSubida(
        e instanceof ErrorImagen ? e.message : "No se pudo subir la imagen. Probá de nuevo.",
      );
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  const mensaje = errorSubida ?? error;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Imagen</span>
      <div className="flex items-center gap-4">
        <ImagenJuego
          url={url}
          nombre={nombre || "el juego"}
          sizes="96px"
          className="size-24 shrink-0 rounded-xl"
        />
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            className="text-primario inline-flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-50"
          >
            {subiendo ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Camera aria-hidden className="size-4" />
            )}
            {subiendo ? "Subiendo…" : url ? "Cambiar foto" : "Agregar foto"}
          </button>
          {url && !subiendo && (
            <button
              type="button"
              onClick={() => onCambio(null)}
              className="text-texto-suave hover:text-texto inline-flex min-h-11 items-center gap-2 text-sm"
            >
              <Trash2 aria-hidden className="size-4" />
              Quitar
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo de imagen"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void subir(archivo);
        }}
      />
      {mensaje && <p className="text-sm font-medium text-red-700 dark:text-red-400">{mensaje}</p>}
    </div>
  );
}
