import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/layout/registrar-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MiLudoteca", template: "%s · MiLudoteca" },
  description: "Tu catálogo de juegos de mesa, con resúmenes y hojas de turno.",
  applicationName: "MiLudoteca",
  appleWebApp: { capable: true, title: "MiLudoteca", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
