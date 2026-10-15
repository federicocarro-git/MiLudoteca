"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { borrarFoto } from "@/app/partida/[id]/actions";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import type { FotoPartida } from "@/lib/partidas/consultas";
import { BUCKET_FOTOS, MAXIMO_FOTOS, rutaFotoNueva } from "@/lib/partidas/fotos";
import { ErrorImagen, prepararImagen } from "@/lib/imagenes";
import { createClient } from "@/lib/supabase/client";

/**
 * Fotos de la partida. Los jugadores con cuenta suben (achicadas en el
 * navegador, directo a Storage con su sesión); cada uno borra las suyas y el
 * anfitrión, cualquiera.
 */
export function FotosPartida({
  partidaId,
  fotos,
  yo,
  puedeSubir,
  soyAnfitrion,
}: {
  partidaId: string;
  fotos: FotoPartida[];
  yo: string | null;
  puedeSubir: boolean;
  soyAnfitrion: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<FotoPartida | null>(null);
  const [borrando, iniciar] = useTransition();

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      if (!yo) throw new ErrorImagen("Tu sesión venció. Volvé a ingresar.");
      const { blob, extension } = await prepararImagen(archivo);
      const supabase = createClient();
      const { error: errorStorage } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(rutaFotoNueva(partidaId, yo, extension), blob, {
          contentType: blob.type,
          cacheControl: "31536000",
        });
      if (errorStorage) throw errorStorage;
      router.refresh();
    } catch (e) {
      console.error(e);
      setError(e instanceof ErrorImagen ? e.message : "No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  const lleno = fotos.length >= MAXIMO_FOTOS;

  return (
    <div className="space-y-3">
      {fotos.length === 0 ? (
        <p className="text-texto-suave text-sm">Todavía no hay fotos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2" aria-label="Fotos">
          {fotos.map((foto, i) => (
            <li key={foto.ruta}>
              <button
                type="button"
                onClick={() => setAbierta(foto)}
                className="block aspect-square w-full overflow-hidden rounded-xl"
                aria-label={`Ver foto ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ya vienen achicadas */}
                <img src={foto.url} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {puedeSubir && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir foto"
            onChange={(e) => e.target.files?.[0] && void subir(e.target.files[0])}
          />
          <Boton
            variante="secundario"
            disabled={subiendo || lleno}
            onClick={() => input.current?.click()}
          >
            {subiendo ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Camera aria-hidden className="size-4" />
            )}
            {subiendo ? "Subiendo…" : lleno ? `Máximo ${MAXIMO_FOTOS} fotos` : "Agregar foto"}
          </Boton>
        </>
      )}
      <p
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>

      <Hoja
        abierta={abierta !== null}
        onCerrar={() => setAbierta(null)}
        titulo="Foto de la partida"
      >
        {abierta && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ya vienen achicadas */}
            <img src={abierta.url} alt="Foto de la partida" className="w-full rounded-xl" />
            {(soyAnfitrion || (yo && abierta.autorId === yo)) && (
              <Boton
                variante="secundario"
                disabled={borrando}
                onClick={() =>
                  iniciar(async () => {
                    const r = await borrarFoto(abierta.ruta);
                    setError(r.ok ? null : r.error);
                    setAbierta(null);
                  })
                }
              >
                {borrando ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="size-4" />
                )}
                Borrar foto
              </Boton>
            )}
          </div>
        )}
      </Hoja>
    </div>
  );
}
