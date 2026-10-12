// Procesamiento de imágenes en el navegador antes de subirlas a Storage.

export const LADO_MAXIMO = 1200;
export const TAMANO_MAXIMO_ORIGINAL = 20 * 1024 * 1024;
const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
];

export class ErrorImagen extends Error {}

/**
 * Achica la imagen para que su lado mayor no pase de LADO_MAXIMO y la
 * convierte a WebP (o JPEG si el navegador no sabe codificar WebP). Así las
 * fotos del celular (5-10 MB) quedan en ~100-300 KB.
 */
export async function prepararImagen(archivo: File): Promise<{ blob: Blob; extension: string }> {
  if (archivo.type && !TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new ErrorImagen("Ese archivo no es una imagen compatible (JPG, PNG, WebP).");
  }
  if (archivo.size > TAMANO_MAXIMO_ORIGINAL) {
    throw new ErrorImagen("La imagen es muy grande (máximo 20 MB).");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new ErrorImagen("No se pudo leer la imagen. Probá con otra (JPG o PNG).");
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErrorImagen("Tu navegador no pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const aBlob = (tipo: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, 0.85));
  const webp = await aBlob("image/webp");
  if (webp?.type === "image/webp") return { blob: webp, extension: "webp" };
  const jpeg = await aBlob("image/jpeg");
  if (jpeg) return { blob: jpeg, extension: "jpg" };
  throw new ErrorImagen("Tu navegador no pudo procesar la imagen.");
}
