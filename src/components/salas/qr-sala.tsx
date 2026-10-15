import "server-only";
import QRCode from "qrcode";

/**
 * QR con el link a la sala, como SVG generado en el servidor (no suma
 * JavaScript al cliente). Se dibuja siempre en negro sobre blanco: los
 * lectores fallan con los colores invertidos del modo oscuro.
 */
export async function svgQrSala(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
