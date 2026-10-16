import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Nunito } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/layout/registrar-service-worker";
import "./globals.css";

// Nunito para el texto, Fraunces para títulos y números grandes y Caveat
// ("a mano") solo para detalles: la pizarra y las notas.
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: "600" });

export const metadata: Metadata = {
  title: { default: "MiLudoteca", template: "%s · MiLudoteca" },
  description: "Tu estante de juegos de mesa, con resúmenes y hojas de turno.",
  applicationName: "MiLudoteca",
  appleWebApp: { capable: true, title: "MiLudoteca", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3e9d8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1511" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${nunito.variable} ${fraunces.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
