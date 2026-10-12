export const BUCKET_IMAGENES = "imagenes-juegos";

/**
 * Si la URL es una imagen del bucket subida por este usuario, devuelve su ruta
 * dentro del bucket (para poder borrarla). Si no (BGG, otro usuario, otra
 * URL), null.
 */
export function rutaImagenPropia(url: string | null, userId: string): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET_IMAGENES}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  let ruta: string;
  try {
    ruta = decodeURIComponent(url.slice(i + marca.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (ruta.includes("..")) return null;
  return ruta.startsWith(`${userId}/`) ? ruta : null;
}
