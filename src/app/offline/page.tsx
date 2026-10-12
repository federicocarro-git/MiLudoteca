import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

// La precachea el service worker y la muestra cuando una navegación falla.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <WifiOff aria-hidden className="text-texto-suave size-10" />
      <h1 className="text-xl font-bold">Sin conexión</h1>
      <p className="text-texto-suave text-sm">
        No hay internet. Cuando vuelva la conexión, recargá la página.
      </p>
    </main>
  );
}
