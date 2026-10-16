import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MiLudoteca",
    short_name: "MiLudoteca",
    description: "Tu estante de juegos de mesa, con resúmenes y hojas de turno.",
    lang: "es-AR",
    start_url: "/catalogo",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3e9d8",
    theme_color: "#2f5d50",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
