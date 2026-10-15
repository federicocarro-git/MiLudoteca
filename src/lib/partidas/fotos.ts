export const BUCKET_FOTOS = "fotos-partidas";
export const MAXIMO_FOTOS = 12;

/** Ruta de una foto nueva: <partida>/<autor>_<uuid>.<ext> (el autor va en el nombre). */
export function rutaFotoNueva(partidaId: string, autorId: string, extension: string) {
  return `${partidaId}/${autorId}_${crypto.randomUUID()}.${extension}`;
}

/** Quién subió la foto, a partir del nombre del archivo. */
export function autorDeFoto(nombreArchivo: string): string | null {
  const autor = nombreArchivo.split("_")[0];
  return /^[0-9a-f-]{36}$/i.test(autor) ? autor : null;
}
